"""
Celery task: AI-powered weekly insights generation using Google Gemini.

Gathers account metrics for the past 7 days, calls Gemini with a structured
prompt, and stores the returned JSON in the insight_result table.

AI failures are handled per-type:
  - AIQuotaExceededError    → return error status, do NOT retry (won't help)
  - AIProviderUnavailableError → retry with backoff
  - AIInvalidResponseError  → retry once (transient bad response)
"""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func

from app.core.ai_provider import (
    AIInvalidResponseError,
    AIProviderUnavailableError,
    AIQuotaExceededError,
    get_provider,
)
from app.core.celery_app import celery
from app.core.database import SessionLocal
from app.models.post import Post
from app.models.engagement_metric import EngagementMetric
from app.models.analysis_result import AnalysisResult
from app.models.social_account import SocialAccount
from app.models.organization import Organization
from app.models.insight_result import InsightResult


# Human-readable labels for business profile codes — keeps Gemini grounded
# in the same vocabulary users see in the UI.
_CATEGORY_LABELS = {
    "restaurant_cafe": "Restaurant/Cafe",
    "fashion_clothing": "Fashion/Clothing",
    "beauty_salon": "Beauty/Salon",
    "fitness_gym": "Fitness/Gym",
    "real_estate": "Real Estate",
    "retail_shop": "Retail/Shop",
    "services": "Services",
    "other": "Other",
}

_COUNTRY_LABELS = {
    "AE": "United Arab Emirates",
    "SA": "Saudi Arabia",
    "EG": "Egypt",
    "JO": "Jordan",
    "KW": "Kuwait",
    "QA": "Qatar",
    "BH": "Bahrain",
    "OM": "Oman",
    "TR": "Turkey",
    "SD": "Sudan",
    "OTHER": "Other",
}


def format_business_profile(profile: dict | None) -> str:
    """Format a business_profile dict into a 1-2 line context block for prompts.

    Returns an empty string if the profile is missing or empty so callers can
    safely concatenate without conditional formatting at every call site.
    """
    if not profile:
        return ""
    parts = []
    cat = _CATEGORY_LABELS.get(profile.get("category"), profile.get("category"))
    country = _COUNTRY_LABELS.get(profile.get("country"), profile.get("country"))
    city = (profile.get("city") or "").strip()
    audience_lang = profile.get("audience_language")
    if cat:
        parts.append(f"Industry: {cat}")
    where = ", ".join(p for p in [city, country] if p)
    if where:
        parts.append(f"Location: {where}")
    if audience_lang == "ar":
        parts.append("Target audience speaks Arabic")
    elif audience_lang == "en":
        parts.append("Target audience speaks English")
    elif audience_lang == "both":
        parts.append("Target audience is bilingual (Arabic + English)")
    return ". ".join(parts)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an AI analyst for a social media management tool used by small business owners. Your job is to convert raw social media metrics into UP TO 6 specific, actionable recommendations — not observations.

RULES:
- Generate AT LEAST 4 and UP TO 6 insights, ranked by priority (high → low).
- Never say "your engagement is low" without telling them exactly what to do about it.
- Every recommendation must have a concrete action, a reason, and a timeframe.
- Tone: direct, encouraging, professional. Write as if you are a trusted marketing advisor, not a report generator.
- Respond ONLY in the language specified in the user message (Arabic or English).
- If a BUSINESS CONTEXT line is present, tailor every recommendation to that industry, city, and audience language. A restaurant in Dubai should hear about food photography and local hashtags; a fashion brand in Cairo should hear about styling reels and culturally relevant trends. Generic advice that ignores the business context is a failure.
- Always respond in valid JSON matching the schema below. No preamble, no markdown.

LABEL LENGTH RULES (strict — UI columns are narrow):
- `expected_impact` MUST be 4 words or fewer (e.g. "Sentiment ↑", "Reach +22%", "Save brand reputation").
- `timeframe` MUST be 3 words or fewer (e.g. "5 min", "Today", "Within 24h", "This week").
- `action` may be a sentence, but `title` must be under 8 words.

OUTPUT SCHEMA:
{
  "summary": "2-sentence plain-language overview of this account's performance this week",
  "score": <integer 1-100 representing overall health>,
  "score_change": <integer, positive or negative, vs last week>,
  "insights": [
    {
      "priority": "high" | "medium" | "low",
      "title": "short title under 8 words",
      "finding": "what the data shows, 1 sentence",
      "action": "exactly what to do, specific and concrete",
      "timeframe": "MAX 3 WORDS",
      "expected_impact": "MAX 4 WORDS"
    }
  ],
  "best_post": {
    "post_id": "<id from input>",
    "reason": "why this post outperformed"
  },
  "next_best_time": "day and time to post next, based on audience data"
}"""


def _gather_metrics(db, social_account_id: str, week_start: datetime, week_end: datetime):
    """Gather all metrics for the given account in the 7-day window."""
    account = db.query(SocialAccount).filter(SocialAccount.id == social_account_id).first()
    if not account:
        return None

    org = db.query(Organization).filter(Organization.id == account.organization_id).first()
    business_profile = org.business_profile if org else None
    organization_id = org.id if org else None

    # Posts this week
    posts = (
        db.query(Post)
        .filter(
            Post.social_account_id == social_account_id,
            Post.posted_at >= week_start,
            Post.posted_at < week_end,
        )
        .all()
    )

    if not posts:
        return None

    post_ids = [p.id for p in posts]

    # Engagement metrics for this week's posts
    metrics = (
        db.query(
            func.coalesce(func.sum(EngagementMetric.likes), 0).label("total_likes"),
            func.coalesce(func.sum(EngagementMetric.comments), 0).label("total_comments"),
            func.coalesce(func.sum(EngagementMetric.shares), 0).label("total_shares"),
            func.coalesce(func.sum(EngagementMetric.saves), 0).label("total_saves"),
            func.coalesce(func.sum(EngagementMetric.reach), 0).label("total_reach"),
            func.coalesce(func.sum(EngagementMetric.impressions), 0).label("total_impressions"),
        )
        .filter(EngagementMetric.post_id.in_(post_ids))
        .first()
    )

    total_engagement = metrics.total_likes + metrics.total_comments + metrics.total_shares + metrics.total_saves
    avg_engagement_rate = round(total_engagement / len(posts), 2) if posts else 0

    # Sentiment breakdown
    sentiments = (
        db.query(AnalysisResult.sentiment, func.count(AnalysisResult.id))
        .filter(AnalysisResult.post_id.in_(post_ids))
        .group_by(AnalysisResult.sentiment)
        .all()
    )
    sentiment_counts = {s: c for s, c in sentiments}
    total_analyzed = sum(sentiment_counts.values())
    pct_pos = round(sentiment_counts.get("positive", 0) / total_analyzed * 100) if total_analyzed else 0
    pct_neu = round(sentiment_counts.get("neutral", 0) / total_analyzed * 100) if total_analyzed else 0
    pct_neg = round(sentiment_counts.get("negative", 0) / total_analyzed * 100) if total_analyzed else 0

    # Top 5 posts by engagement (enriched with OCR text + audio transcript)
    top_posts = (
        db.query(
            Post,
            func.coalesce(func.sum(EngagementMetric.likes + EngagementMetric.comments), 0).label("eng"),
            AnalysisResult.sentiment,
            AnalysisResult.ocr_text,
            AnalysisResult.audio_transcript,
            AnalysisResult.topics,
        )
        .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
        .outerjoin(AnalysisResult, AnalysisResult.post_id == Post.id)
        .filter(Post.id.in_(post_ids))
        .group_by(
            Post.id,
            AnalysisResult.sentiment,
            AnalysisResult.ocr_text,
            AnalysisResult.audio_transcript,
            AnalysisResult.topics,
        )
        .order_by(func.coalesce(func.sum(EngagementMetric.likes + EngagementMetric.comments), 0).desc())
        .limit(5)
        .all()
    )

    best_post = top_posts[0] if top_posts else None
    worst_post = top_posts[-1] if top_posts else None

    # Best posting time (hour with highest avg engagement)
    best_hour_row = (
        db.query(
            func.extract("dow", Post.posted_at).label("dow"),
            func.extract("hour", Post.posted_at).label("hour"),
            func.avg(EngagementMetric.likes + EngagementMetric.comments).label("avg_eng"),
        )
        .join(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.id.in_(post_ids))
        .group_by("dow", "hour")
        .order_by(func.avg(EngagementMetric.likes + EngagementMetric.comments).desc())
        .first()
    )

    days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    best_day = days[int(best_hour_row.dow)] if best_hour_row else "N/A"
    best_time = f"{int(best_hour_row.hour)}:00" if best_hour_row else "N/A"

    # Previous week avg engagement for comparison
    prev_start = week_start - timedelta(days=7)
    prev_posts = (
        db.query(Post.id)
        .filter(
            Post.social_account_id == social_account_id,
            Post.posted_at >= prev_start,
            Post.posted_at < week_start,
        )
        .all()
    )
    prev_ids = [p.id for p in prev_posts]
    prev_avg = 0
    if prev_ids:
        prev_total = (
            db.query(
                func.coalesce(func.sum(EngagementMetric.likes + EngagementMetric.comments), 0),
            )
            .filter(EngagementMetric.post_id.in_(prev_ids))
            .scalar()
        ) or 0
        prev_avg = round(prev_total / len(prev_ids), 2)

    # Best content type historically
    best_type_row = (
        db.query(
            Post.content_type,
            func.avg(EngagementMetric.likes + EngagementMetric.comments).label("avg_eng"),
        )
        .join(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id == social_account_id)
        .group_by(Post.content_type)
        .order_by(func.avg(EngagementMetric.likes + EngagementMetric.comments).desc())
        .first()
    )
    best_type = best_type_row.content_type.value if best_type_row and best_type_row.content_type else "image"

    # Format top posts table. Include OCR text and audio transcript when present
    # so Gemini can reason about on-image copy (slogans, prices, product names
    # baked into the graphic) AND spoken audio (reel voiceover, video script)
    # instead of seeing only the caption.
    top_posts_lines = []
    for post, eng, sent, ocr, audio, topics in top_posts:
        ct = post.content_type.value if post.content_type else "unknown"
        line = f"{post.id} | {ct} | {eng} engagements | {sent or 'unanalyzed'}"
        if ocr:
            snippet = ocr.strip().replace("\n", " ")[:200]
            if snippet:
                line += f" | image text: \"{snippet}\""
        if audio:
            snippet = audio.strip().replace("\n", " ")[:200]
            if snippet:
                line += f" | audio transcript: \"{snippet}\""
        if topics:
            line += f" | topics: {', '.join(topics[:3])}"
        top_posts_lines.append(line)

    # Language breakdown across all posts this week — uses analysis_result
    # language_detected (derived from caption + OCR + audio) so it reflects
    # the post's actual content, not just caption-only heuristics.
    lang_rows = (
        db.query(AnalysisResult.language_detected, func.count(AnalysisResult.id))
        .filter(AnalysisResult.post_id.in_(post_ids))
        .group_by(AnalysisResult.language_detected)
        .all()
    )
    lang_counts = {"en": 0, "ar": 0, "unknown": 0}
    for lang, n in lang_rows:
        if lang in lang_counts:
            lang_counts[lang] = n
    lang_total = sum(lang_counts.values()) or 1
    pct_ar = round(lang_counts["ar"] / lang_total * 100)
    pct_en = round(lang_counts["en"] / lang_total * 100)

    # Topic frequency — count every topic string across this week's posts and
    # take the top 5. Topics come from Gemini at analysis time; they cluster
    # organically across posts about similar subject matter.
    topic_rows = (
        db.query(AnalysisResult.topics)
        .filter(AnalysisResult.post_id.in_(post_ids))
        .filter(AnalysisResult.topics.isnot(None))
        .all()
    )
    topic_counter: dict[str, int] = {}
    for (row_topics,) in topic_rows:
        if not row_topics:
            continue
        for t in row_topics:
            if isinstance(t, str) and t.strip():
                key = t.strip().lower()
                topic_counter[key] = topic_counter.get(key, 0) + 1
    top_topics = sorted(topic_counter.items(), key=lambda kv: kv[1], reverse=True)[:5]
    topics_line = ", ".join(f"{term} (x{count})" for term, count in top_topics) or "(none)"

    return {
        "account_name": account.username or "Unknown",
        "platform": account.platform.value if account.platform else "instagram",
        "total_posts": len(posts),
        "total_impressions": metrics.total_impressions,
        "avg_engagement_rate": avg_engagement_rate,
        "prev_avg_engagement": prev_avg,
        "best_post_id": str(best_post[0].id) if best_post else None,
        "best_post_eng": best_post[1] if best_post else 0,
        "worst_post_id": str(worst_post[0].id) if worst_post else None,
        "worst_post_eng": worst_post[1] if worst_post else 0,
        "best_day": best_day,
        "best_time": best_time,
        "pct_positive": pct_pos,
        "pct_neutral": pct_neu,
        "pct_negative": pct_neg,
        "top_posts_table": "\n".join(top_posts_lines),
        "best_content_type": best_type,
        "date_range": f"{week_start.strftime('%Y-%m-%d')} to {week_end.strftime('%Y-%m-%d')}",
        "pct_arabic": pct_ar,
        "pct_english": pct_en,
        "top_topics": topics_line,
        "business_profile": business_profile,
        "organization_id": organization_id,
    }


def _build_user_message(data: dict, language: str = "English", db=None) -> str:
    """Build the user message from gathered metrics, matching the prompt schema."""
    bp_line = format_business_profile(data.get("business_profile"))
    bp_block = f"BUSINESS CONTEXT: {bp_line}\n\n" if bp_line else ""
    brand_block = ""
    if db is not None and data.get("organization_id"):
        from app.core.brand_context import format_brand_identity
        brand_block_raw = format_brand_identity(data["organization_id"], db)
        brand_block = f"{brand_block_raw}\n" if brand_block_raw else ""
    return f"""Analyze this account's performance for the week of {data['date_range']}.
Language: {language}

ACCOUNT: {data['account_name']} on {data['platform']}

{bp_block}{brand_block}METRICS THIS WEEK:
- Total posts: {data['total_posts']}
- Total impressions: {data['total_impressions']}
- Avg engagement per post: {data['avg_engagement_rate']}
- Top performing post ID: {data['best_post_id']} — {data['best_post_eng']} engagements
- Worst performing post ID: {data['worst_post_id']} — {data['worst_post_eng']} engagements
- Best posting time (by engagement): {data['best_day']}, {data['best_time']}
- Sentiment breakdown: {data['pct_positive']}% positive, {data['pct_neutral']}% neutral, {data['pct_negative']}% negative

TOP POSTS THIS WEEK (each row: id | type | engagements | sentiment | optional image-text OCR | optional audio transcript from Whisper | optional topics):
{data['top_posts_table']}

CONTENT MIX:
- Language breakdown: {data['pct_arabic']}% Arabic, {data['pct_english']}% English
- Top topics this week: {data['top_topics']}

HISTORICAL CONTEXT:
- Last week avg engagement: {data['prev_avg_engagement']}
- Best performing content type historically: {data['best_content_type']}
- Account goal: growth"""


def _call_gemini(user_message: str, *, account_id: str | None = None) -> dict:
    """Call the configured insights provider (Gemini) and return parsed JSON.

    Raises `AIProviderError` (or one of its subclasses) on any failure — the
    Celery task wrapper decides whether to retry or surface as terminal.
    """
    return get_provider("insights").generate_json(
        SYSTEM_PROMPT, user_message, temperature=0.4,
        account_id=account_id, task="insights", source="user",
    )


def _normalize_language(language: str) -> str:
    """Map long-form ('English'/'Arabic') or short-form ('en'/'en-US'/'ar') to
    the two-letter code stored in `insight_result.language`."""
    l = (language or "").lower()
    if l.startswith("ar") or "arabic" in l:
        return "ar"
    return "en"


@celery.task(name="generate_weekly_insights", bind=True, max_retries=2)
def generate_weekly_insights(self, social_account_id: str, language: str = "English"):
    """Generate AI-powered weekly insights for a social account.

    Rows are keyed by (social_account_id, language) — one per language per
    account. A fresh generation for the same language overwrites the prior
    row's content via append + score_change comparison against the previous
    row in that same language bucket, so EN and AR trendlines stay independent.
    """
    db = SessionLocal()
    lang_code = _normalize_language(language)
    try:
        now = datetime.now(timezone.utc)
        week_end = now
        week_start = now - timedelta(days=7)

        logger.info("Generating insights for account %s (%s, %s to %s)",
                     social_account_id, lang_code, week_start, week_end)

        data = _gather_metrics(db, social_account_id, week_start, week_end)
        if not data:
            # Fallback: use all posts if no posts in last 7 days
            all_posts_count = db.query(func.count(Post.id)).filter(
                Post.social_account_id == social_account_id
            ).scalar()
            if all_posts_count and all_posts_count > 0:
                earliest = db.query(func.min(Post.posted_at)).filter(
                    Post.social_account_id == social_account_id
                ).scalar()
                data = _gather_metrics(db, social_account_id, earliest, now)

            if not data:
                logger.warning("No post data for account %s", social_account_id)
                return {"status": "error", "detail": "No posts found for analysis"}

        user_message = _build_user_message(data, language, db=db)
        try:
            result = _call_gemini(user_message, account_id=social_account_id)
        except AIQuotaExceededError as exc:
            # Quota retries don't help — they just spend more quota. Surface
            # as a terminal error and let the next scheduled run pick it up.
            logger.warning(
                "Insights quota exceeded for account %s: %s",
                social_account_id, exc,
            )
            return {
                "status": "error",
                "detail": "AI quota exceeded; try again later.",
                "retry_after_hours": exc.retry_after_hours,
            }
        except (AIProviderUnavailableError, AIInvalidResponseError) as exc:
            logger.error(
                "Insights AI failure for %s, retrying: %s",
                social_account_id, exc,
            )
            raise self.retry(exc=exc, countdown=120)

        # Resolve best_post_id to a real UUID (Gemini returns the string we gave it)
        best_post_id = None
        if result.get("best_post", {}).get("post_id"):
            raw_id = result["best_post"]["post_id"]
            exists = db.query(Post.id).filter(Post.id == raw_id).first()
            if exists:
                best_post_id = raw_id

        # Compare score against the previous insight in the SAME language bucket
        # so EN and AR trendlines don't cross-contaminate.
        prev_insight = (
            db.query(InsightResult)
            .filter(
                InsightResult.social_account_id == social_account_id,
                InsightResult.language == lang_code,
            )
            .order_by(InsightResult.generated_at.desc())
            .first()
        )
        score_change = result.get("score_change", 0)
        if prev_insight and prev_insight.score and result.get("score"):
            score_change = result["score"] - prev_insight.score

        insight = InsightResult(
            social_account_id=social_account_id,
            week_start=week_start,
            summary=result.get("summary", ""),
            score=result.get("score"),
            score_change=score_change,
            insights=result.get("insights", []),
            best_post_id=best_post_id,
            next_best_time=result.get("next_best_time", ""),
            language=lang_code,
            generated_at=now,
        )
        db.add(insight)
        db.commit()

        logger.info("Insights saved for account %s — score=%s", social_account_id, result.get("score"))
        return {
            "status": "ok",
            "score": result.get("score"),
            "insights_count": len(result.get("insights", [])),
        }

    except Exception as exc:
        db.rollback()
        logger.error("generate_weekly_insights failed for %s: %s", social_account_id, exc)
        raise self.retry(exc=exc, countdown=120)
    finally:
        db.close()


@celery.task(name="generate_insights_all_accounts")
def generate_insights_all_accounts():
    """Queue weekly insight generation for every active social account, EN + AR.

    Scheduled via Celery Beat (weekly Sun 03:00 UTC). Uses `.delay()` so each
    per-account run is independently retryable and their failures don't cascade.
    """
    db = SessionLocal()
    try:
        accounts = db.query(SocialAccount).filter(SocialAccount.is_active == True).all()  # noqa: E712
        queued = 0
        for account in accounts:
            generate_weekly_insights.delay(str(account.id), "English")
            generate_weekly_insights.delay(str(account.id), "Arabic")
            queued += 2
        logger.info(
            "Queued %d insight tasks across %d accounts",
            queued, len(accounts),
        )
        return {"status": "ok", "accounts": len(accounts), "tasks_queued": queued}
    finally:
        db.close()
