"""
Analytics endpoints.

GET  /overview              — basic KPI data for the authenticated user's organization.
GET  /posts/breakdown       — per-content-type engagement stats + posting dates.
POST /analyze               — trigger NLP analysis for all unanalyzed posts.
GET  /sentiment             — sentiment breakdown across analyzed posts (Pro).
GET  /sentiment/summary     — intelligence summary: WoW counts, keywords, highlights, needs-attention, samples (Pro).
GET  /sentiment/timeline    — daily sentiment counts over time (Pro).
GET  /comments              — full comment feed with per-comment sentiment (Pro).
GET  /accounts              — active social accounts for the organization.
GET  /segments              — audience segments for a social account (Pro).
POST /segments/regenerate   — trigger K-means clustering, returns task_id (Pro).
GET  /insights              — latest AI-generated weekly insight (Pro).
POST /insights/generate     — trigger Gemini insight generation, returns task_id (Pro).
"""
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Literal

import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from app.core.ai_degradation import build_fresh_meta
from app.core.ai_provider import AIProviderError, get_provider
from app.core.database import get_db
from app.core.deps import get_current_user, RequireFeature
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.models.analysis_result import AnalysisResult
from app.models.engagement_metric import EngagementMetric
from app.models.social_account import SocialAccount
from app.models.audience_segment import AudienceSegment
from app.models.insight_result import InsightResult
from app.tasks.nlp_analysis import analyze_posts
from app.tasks.segmentation import segment_audience
from app.tasks.insights import generate_weekly_insights

logger = logging.getLogger(__name__)


# ── Keyword extraction helpers (shared by sentiment summary) ─────────────

_STOPWORDS_EN = {
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "shall",
    "to", "of", "in", "on", "at", "for", "with", "by", "from", "as", "about", "into",
    "i", "you", "he", "she", "it", "we", "they", "me", "my", "your", "yours", "his", "her",
    "hers", "its", "our", "ours", "their", "theirs", "mine",
    "this", "that", "these", "those", "here", "there", "what", "when", "where", "why", "how",
    "not", "no", "so", "too", "very", "just", "also", "only", "even", "if", "then", "than",
    "can", "cannot", "cant", "yes", "yeah", "ok", "okay", "lol", "omg", "wow", "yep", "nope",
    "am", "pm", "u", "ur", "pls", "plz", "hi", "hey", "hello",
    "some", "any", "all", "most", "more", "less", "such", "like",
}

_STOPWORDS_AR = {
    "في", "من", "إلى", "الى", "على", "عن", "مع", "هذا", "هذه", "ذلك", "تلك", "هناك",
    "هو", "هي", "أنا", "انا", "أنت", "انت", "نحن", "هم", "هن", "كان", "كانت", "يكون",
    "أن", "ان", "إن", "لا", "لم", "لن", "ما", "ماذا", "متى", "أين", "اين", "كيف",
    "الذي", "التي", "كل", "بعض", "قد", "و", "أو", "او", "ثم", "لكن", "أيضا", "ايضا",
    "يا", "والله", "الله", "مش", "مو", "يعني", "بس", "شو", "شي",
}

_STOPWORDS = _STOPWORDS_EN | _STOPWORDS_AR
_WORD_SPLIT = re.compile(r"[\W_]+", re.UNICODE)


def _tokenize(text: str) -> list[str]:
    """Tokenize a comment into keyword candidates (lowercased, stopword-filtered)."""
    if not text:
        return []
    lowered = text.lower()
    out: list[str] = []
    for tok in _WORD_SPLIT.split(lowered):
        if len(tok) < 3 or tok.isdigit() or tok in _STOPWORDS:
            continue
        out.append(tok)
    return out


def _extract_keywords(
    analyzed_comments: list[tuple[str, str]], top_n: int = 5
) -> list[dict]:
    """Take [(text, sentiment)] → top N keywords with dominant sentiment + total count."""
    counts: dict[str, dict[str, int]] = {}
    for text, sentiment in analyzed_comments:
        for tok in _tokenize(text):
            bucket = counts.setdefault(tok, {"positive": 0, "neutral": 0, "negative": 0})
            if sentiment in bucket:
                bucket[sentiment] += 1

    ranked = sorted(
        counts.items(),
        key=lambda kv: sum(kv[1].values()),
        reverse=True,
    )[:top_n]

    keywords = []
    for term, per_sentiment in ranked:
        total = sum(per_sentiment.values())
        dominant = max(per_sentiment.items(), key=lambda kv: kv[1])[0]
        keywords.append({"term": term, "count": total, "sentiment": dominant})
    return keywords


def _generate_highlights(
    *,
    total_week: int,
    current_counts: dict[str, int],
    wow_change: dict[str, int],
    keywords: list[dict],
    language: str = "en",
    account_id: str | None = None,
    source: str = "user",
) -> str:
    """Ask Gemini for a 2-sentence audience-intelligence summary.

    Raises `AIProviderError` on provider failure so the caller can decide
    whether to serve a stale cache entry or surface the degraded state.
    """
    if total_week == 0:
        return ""

    lang_label = "Arabic" if language == "ar" else "English"
    sys_prompt = (
        "You are an audience-insights writer for a social media analytics tool. "
        "Given comment-sentiment data from an Instagram creator's past week, write "
        "EXACTLY TWO sentences summarizing what the audience is saying. "
        "Be specific — reference the percentages, top keywords, and week-over-week "
        "trend direction. Use a neutral, professional tone. "
        "No markdown, no bullets, no emojis, no preamble. "
        f"Respond ENTIRELY in {lang_label}. This is a hard requirement — "
        f"do not switch languages even if the input keywords are in a different language."
    )

    def pct(n: int) -> int:
        return round(100 * n / total_week) if total_week else 0

    kw_line = ", ".join(
        f"{k['term']} ({k['sentiment']}, n={k['count']})" for k in keywords
    ) or "(none)"
    user_msg = (
        f"Total comments this week: {total_week}\n"
        f"Sentiment this week: {pct(current_counts.get('positive', 0))}% positive, "
        f"{pct(current_counts.get('neutral', 0))}% neutral, "
        f"{pct(current_counts.get('negative', 0))}% negative\n"
        f"Week-over-week percentage-point change: "
        f"positive {wow_change.get('positive', 0):+d}, "
        f"neutral {wow_change.get('neutral', 0):+d}, "
        f"negative {wow_change.get('negative', 0):+d}\n"
        f"Top keywords: {kw_line}"
    )

    return get_provider("insights").generate_text(
        sys_prompt, user_msg, temperature=0.4,
        account_id=account_id, task="insights", source=source,
    )

router = APIRouter()


@router.get("/overview")
def analytics_overview(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return top-level KPI summary scoped to the user's organization."""

    # Get social account IDs for this organization
    account_ids = [
        a.id for a in db.query(SocialAccount.id).filter(
            SocialAccount.organization_id == user.organization_id,
            SocialAccount.is_active == True,
        ).all()
    ]

    if not account_ids:
        return {
            "success": True,
            "data": {
                "total_posts": 0, "total_likes": 0, "total_comments": 0,
                "total_shares": 0, "total_saves": 0, "total_reach": 0,
                "total_impressions": 0, "total_engagement": 0,
                "avg_engagement_per_post": 0.0, "connected_accounts": 0,
            },
        }

    total_posts = db.query(func.count(Post.id)).filter(
        Post.social_account_id.in_(account_ids),
    ).scalar() or 0

    metrics = db.query(
        func.coalesce(func.sum(EngagementMetric.likes), 0).label("total_likes"),
        func.coalesce(func.sum(EngagementMetric.comments), 0).label("total_comments"),
        func.coalesce(func.sum(EngagementMetric.shares), 0).label("total_shares"),
        func.coalesce(func.sum(EngagementMetric.saves), 0).label("total_saves"),
        func.coalesce(func.sum(EngagementMetric.reach), 0).label("total_reach"),
        func.coalesce(func.sum(EngagementMetric.impressions), 0).label("total_impressions"),
    ).join(Post, EngagementMetric.post_id == Post.id).filter(
        Post.social_account_id.in_(account_ids),
    ).first()

    total_engagement = metrics.total_likes + metrics.total_comments + metrics.total_shares + metrics.total_saves
    avg_engagement = round(total_engagement / total_posts, 2) if total_posts > 0 else 0.0

    return {
        "success": True,
        "data": {
            "total_posts": total_posts,
            "total_likes": metrics.total_likes,
            "total_comments": metrics.total_comments,
            "total_shares": metrics.total_shares,
            "total_saves": metrics.total_saves,
            "total_reach": metrics.total_reach,
            "total_impressions": metrics.total_impressions,
            "total_engagement": total_engagement,
            "avg_engagement_per_post": avg_engagement,
            "connected_accounts": len(account_ids),
        },
    }


@router.get("/posts/breakdown")
def posts_breakdown(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Per-content-type engagement stats + posting dates for the org."""

    account_ids = [
        a.id for a in db.query(SocialAccount.id).filter(
            SocialAccount.organization_id == user.organization_id,
            SocialAccount.is_active == True,
        ).all()
    ]

    if not account_ids:
        return {"success": True, "data": {"by_type": [], "posting_dates": []}}

    # Avg engagement per content type
    type_stats = (
        db.query(
            Post.content_type,
            func.count(Post.id).label("count"),
            func.coalesce(func.avg(EngagementMetric.likes), 0).label("avg_likes"),
            func.coalesce(func.avg(EngagementMetric.comments), 0).label("avg_comments"),
        )
        .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id.in_(account_ids))
        .group_by(Post.content_type)
        .all()
    )

    by_type = [
        {
            "content_type": row.content_type or "unknown",
            "count": row.count,
            "avg_likes": round(float(row.avg_likes), 1),
            "avg_comments": round(float(row.avg_comments), 1),
        }
        for row in type_stats
    ]

    # Posting dates (for calendar heatmap)
    date_counts = (
        db.query(
            cast(Post.posted_at, Date).label("date"),
            func.count(Post.id).label("count"),
        )
        .filter(Post.social_account_id.in_(account_ids))
        .group_by(cast(Post.posted_at, Date))
        .order_by(cast(Post.posted_at, Date))
        .all()
    )

    posting_dates = [
        {"date": str(row.date), "count": row.count}
        for row in date_counts
    ]

    # Language breakdown: post language (from NLP analysis of caption + OCR +
    # audio) joined to engagement. Lets the My Posts page show % of posts per
    # language AND which language gets better engagement.
    lang_rows = (
        db.query(
            AnalysisResult.language_detected.label("language"),
            func.count(AnalysisResult.id).label("count"),
            func.coalesce(func.avg(EngagementMetric.likes), 0).label("avg_likes"),
            func.coalesce(func.avg(EngagementMetric.comments), 0).label("avg_comments"),
        )
        .join(Post, AnalysisResult.post_id == Post.id)
        .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id.in_(account_ids))
        .filter(AnalysisResult.post_id.isnot(None))
        .group_by(AnalysisResult.language_detected)
        .all()
    )
    by_language = [
        {
            "language": row.language or "unknown",
            "count": row.count,
            "avg_likes": round(float(row.avg_likes), 1),
            "avg_comments": round(float(row.avg_comments), 1),
            "avg_engagement": round(float(row.avg_likes) + float(row.avg_comments), 1),
        }
        for row in lang_rows
    ]

    return {
        "success": True,
        "data": {
            "by_type": by_type,
            "posting_dates": posting_dates,
            "by_language": by_language,
        },
    }


@router.get("/posts/top")
def top_posts(
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return top posts by engagement with thumbnails for the My Posts table.

    Falls back to media_url for image posts (Instagram returns the image URL
    there); video posts get thumbnail_url from raw_data when present.
    """
    account_ids = [
        a.id for a in db.query(SocialAccount.id).filter(
            SocialAccount.organization_id == user.organization_id,
            SocialAccount.is_active == True,
        ).all()
    ]

    if not account_ids:
        return {"success": True, "data": {"posts": []}}

    rows = (
        db.query(
            Post.id,
            Post.caption,
            Post.content_type,
            Post.media_url,
            Post.posted_at,
            Post.raw_data,
            func.coalesce(func.sum(EngagementMetric.likes), 0).label("likes"),
            func.coalesce(func.sum(EngagementMetric.comments), 0).label("comments"),
        )
        .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id.in_(account_ids))
        .group_by(Post.id)
        .order_by(
            (
                func.coalesce(func.sum(EngagementMetric.likes), 0)
                + func.coalesce(func.sum(EngagementMetric.comments), 0)
            ).desc()
        )
        .limit(min(max(limit, 1), 50))
        .all()
    )

    posts = []
    for row in rows:
        raw = row.raw_data or {}
        ct = row.content_type.value if row.content_type else "image"
        # For images/carousels media_url is the image itself; videos/reels have
        # a separate thumbnail_url in the Graph API response.
        thumbnail = None
        if ct in ("image", "carousel"):
            thumbnail = row.media_url or raw.get("thumbnail_url")
        else:
            thumbnail = raw.get("thumbnail_url") or row.media_url
        posts.append({
            "id": str(row.id),
            "caption": row.caption or "",
            "content_type": ct,
            "thumbnail_url": thumbnail,
            "permalink": raw.get("permalink"),
            "likes": int(row.likes or 0),
            "comments": int(row.comments or 0),
            "posted_at": row.posted_at.isoformat() if row.posted_at else None,
        })

    return {"success": True, "data": {"posts": posts}}


@router.post("/analyze")
def trigger_analysis(user: User = Depends(get_current_user)):
    """Queue NLP analysis for all unanalyzed posts."""
    task = analyze_posts.delay()
    return {
        "success": True,
        "data": {"task_id": task.id, "status": "queued"},
    }


@router.get("/sentiment")
def sentiment_overview(
    user: User = Depends(RequireFeature("sentiment_analysis")),
    db: Session = Depends(get_db),
):
    """Return sentiment distribution scoped to user's organization (Pro)."""

    account_ids = [
        a.id for a in db.query(SocialAccount.id).filter(
            SocialAccount.organization_id == user.organization_id,
        ).all()
    ]

    post_ids_q = db.query(Post.id).filter(Post.social_account_id.in_(account_ids)).subquery()

    total_analyzed = db.query(func.count(AnalysisResult.id)).filter(
        AnalysisResult.post_id.in_(db.query(post_ids_q.c.id)),
    ).scalar() or 0

    breakdown = (
        db.query(
            AnalysisResult.sentiment,
            func.count(AnalysisResult.id).label("count"),
            func.round(func.avg(AnalysisResult.sentiment_score).cast(sqlalchemy.Numeric), 4).label("avg_score"),
        )
        .filter(AnalysisResult.post_id.in_(db.query(post_ids_q.c.id)))
        .group_by(AnalysisResult.sentiment)
        .all()
    )

    sentiment_data = {
        row.sentiment: {"count": row.count, "avg_score": float(row.avg_score or 0)}
        for row in breakdown
    }

    total_posts = db.query(func.count(Post.id)).filter(
        Post.social_account_id.in_(account_ids),
    ).scalar() or 0
    pending = total_posts - total_analyzed

    return {
        "success": True,
        "data": {
            "total_analyzed": total_analyzed,
            "pending_analysis": pending,
            "sentiment": sentiment_data,
        },
    }


@router.get("/comments")
def comments_analytics(
    account_id: str | None = None,
    limit: int = 200,
    user: User = Depends(RequireFeature("sentiment_analysis")),
    db: Session = Depends(get_db),
):
    """Return comment-sentiment analytics for the user's organization (Pro).

    Differentiator vs. Meta Business Suite: Meta shows raw comment text only.
    BASIRET classifies every comment with multilingual XLM-RoBERTa and surfaces
    sentiment counts + language-aware samples (Arabic comments preserved as-is
    for client-side RTL rendering).
    """
    accounts_q = db.query(SocialAccount).filter(
        SocialAccount.organization_id == user.organization_id,
    )
    if account_id:
        accounts_q = accounts_q.filter(SocialAccount.id == account_id)
    account_ids = [a.id for a in accounts_q.all()]

    if not account_ids:
        return {
            "success": True,
            "data": {
                "total_comments": 0,
                "total_analyzed": 0,
                "sentiment_counts": {"positive": 0, "neutral": 0, "negative": 0},
                "comments": [],
            },
        }

    post_ids_subq = db.query(Post.id).filter(Post.social_account_id.in_(account_ids)).subquery()

    base_q = db.query(Comment).filter(Comment.post_id.in_(db.query(post_ids_subq.c.id)))
    total_comments = base_q.count()

    analyzed_q = (
        db.query(
            Comment,
            AnalysisResult.sentiment,
            AnalysisResult.sentiment_score,
            AnalysisResult.language_detected,
        )
        .join(AnalysisResult, AnalysisResult.comment_id == Comment.id)
        .filter(Comment.post_id.in_(db.query(post_ids_subq.c.id)))
    )

    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    rows = (
        db.query(AnalysisResult.sentiment, func.count(AnalysisResult.id))
        .join(Comment, AnalysisResult.comment_id == Comment.id)
        .filter(Comment.post_id.in_(db.query(post_ids_subq.c.id)))
        .group_by(AnalysisResult.sentiment)
        .all()
    )
    for label, count in rows:
        if label in sentiment_counts:
            sentiment_counts[label] = count
    total_analyzed = sum(sentiment_counts.values())

    feed_rows = (
        analyzed_q.order_by(Comment.created_at.desc().nullslast())
        .limit(min(max(limit, 1), 500))
        .all()
    )

    comments_payload = [
        {
            "id": str(c.id),
            "post_id": str(c.post_id),
            "platform_comment_id": c.platform_comment_id,
            "text": c.text,
            "author_username": c.author_username,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "sentiment": sentiment,
            "sentiment_score": float(score) if score is not None else None,
            "language": language,
        }
        for (c, sentiment, score, language) in feed_rows
    ]

    return {
        "success": True,
        "data": {
            "total_comments": total_comments,
            "total_analyzed": total_analyzed,
            "sentiment_counts": sentiment_counts,
            "comments": comments_payload,
        },
    }


@router.get("/sentiment/summary")
def sentiment_summary(
    account_id: str | None = None,
    language: str = "en",
    user: User = Depends(RequireFeature("sentiment_analysis")),
    db: Session = Depends(get_db),
):
    """Audience-intelligence summary for the Sentiment page (Pro).

    Replaces the former scrollable-feed shape with a compact intelligence digest:
      - current-week sentiment counts + week-over-week percentage-point deltas
      - top 5 keywords extracted from analyzed comments with dominant sentiment
      - a 2-sentence Gemini-generated "highlights" summary
      - posts needing attention (>2 negative comments) with caption + permalink
      - three sample comments (one positive, one neutral, one negative)

    Week boundaries use the comment's `created_at` (the Instagram timestamp) so
    the WoW delta reflects audience reactions, not sync times.
    """
    # Scope to the user's org, optionally filter to a single account
    accounts_q = db.query(SocialAccount).filter(
        SocialAccount.organization_id == user.organization_id,
    )
    if account_id:
        accounts_q = accounts_q.filter(SocialAccount.id == account_id)
    account_ids = [a.id for a in accounts_q.all()]

    empty_counts = {"positive": 0, "neutral": 0, "negative": 0}
    empty_response = {
        "success": True,
        "data": {
            "total_week": 0,
            "total_prev_week": 0,
            "current_counts": dict(empty_counts),
            "previous_counts": dict(empty_counts),
            "wow_change": dict(empty_counts),
            "keywords": [],
            "highlights": "",
            "needs_attention": [],
            "samples": {"positive": None, "neutral": None, "negative": None},
        },
    }
    if not account_ids:
        return empty_response

    post_ids_subq = db.query(Post.id).filter(
        Post.social_account_id.in_(account_ids),
    ).subquery()

    now = datetime.now(timezone.utc)
    wk1_start = now - timedelta(days=7)
    wk2_start = now - timedelta(days=14)

    # ── Week-over-week counts ────────────────────────────────────────
    def _bucket_counts(start: datetime, end: datetime) -> dict[str, int]:
        rows = (
            db.query(AnalysisResult.sentiment, func.count(AnalysisResult.id))
            .join(Comment, AnalysisResult.comment_id == Comment.id)
            .filter(Comment.post_id.in_(db.query(post_ids_subq.c.id)))
            .filter(Comment.created_at >= start)
            .filter(Comment.created_at < end)
            .group_by(AnalysisResult.sentiment)
            .all()
        )
        out = dict(empty_counts)
        for label, n in rows:
            if label in out:
                out[label] = n
        return out

    current_counts = _bucket_counts(wk1_start, now)
    previous_counts = _bucket_counts(wk2_start, wk1_start)
    total_week = sum(current_counts.values())
    total_prev = sum(previous_counts.values())

    def _pp(n: int, total: int) -> int:
        return round(100 * n / total) if total else 0

    wow_change = {
        label: _pp(current_counts[label], total_week) - _pp(previous_counts[label], total_prev)
        for label in ("positive", "neutral", "negative")
    }

    # ── Keywords (from all analyzed comments in current + previous week) ─
    kw_rows = (
        db.query(Comment.text, AnalysisResult.sentiment)
        .join(AnalysisResult, AnalysisResult.comment_id == Comment.id)
        .filter(Comment.post_id.in_(db.query(post_ids_subq.c.id)))
        .filter(Comment.created_at >= wk2_start)
        .filter(Comment.text.isnot(None))
        .all()
    )
    keywords = _extract_keywords(
        [(text, sentiment) for (text, sentiment) in kw_rows],
        top_n=5,
    )

    # ── Needs attention: posts with >2 negative comments (all-time window) ─
    attention_rows = (
        db.query(
            Post.id,
            Post.caption,
            Post.raw_data,
            Post.platform_post_id,
            func.count(AnalysisResult.id).label("neg_count"),
        )
        .join(Comment, Comment.post_id == Post.id)
        .join(AnalysisResult, AnalysisResult.comment_id == Comment.id)
        .filter(AnalysisResult.sentiment == "negative")
        .filter(Post.social_account_id.in_(account_ids))
        .group_by(Post.id, Post.caption, Post.raw_data, Post.platform_post_id)
        .having(func.count(AnalysisResult.id) > 2)
        .order_by(func.count(AnalysisResult.id).desc())
        .limit(10)
        .all()
    )
    needs_attention = [
        {
            "post_id": str(row.id),
            "platform_post_id": row.platform_post_id,
            "caption": (row.caption or "")[:280],
            "permalink": (row.raw_data or {}).get("permalink") if row.raw_data else None,
            "negative_count": row.neg_count,
        }
        for row in attention_rows
    ]

    # ── Samples: one per sentiment, most recent first ─────────────────
    def _sample(sentiment: str) -> dict | None:
        row = (
            db.query(Comment, AnalysisResult.language_detected)
            .join(AnalysisResult, AnalysisResult.comment_id == Comment.id)
            .filter(Comment.post_id.in_(db.query(post_ids_subq.c.id)))
            .filter(AnalysisResult.sentiment == sentiment)
            .filter(Comment.text.isnot(None))
            .order_by(Comment.created_at.desc().nullslast())
            .first()
        )
        if not row:
            return None
        c, lang = row
        return {
            "id": str(c.id),
            "post_id": str(c.post_id),
            "text": c.text,
            "author_username": c.author_username,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "language": lang,
        }

    samples = {
        "positive": _sample("positive"),
        "neutral": _sample("neutral"),
        "negative": _sample("negative"),
    }

    # ── Gemini highlights (SWR cached: fresh ≤24h, stale 24-72h) ─────
    lang = "ar" if str(language).lower().startswith("ar") else "en"
    from app.api.v1.ai_pages import _resolve_ai_payload

    highlights = ""
    meta = build_fresh_meta()
    cache_account = str(account_ids[0]) if account_ids else None
    if cache_account and total_week > 0:
        def _compute() -> dict:
            return {
                "highlights": _generate_highlights(
                    total_week=total_week,
                    current_counts=current_counts,
                    wow_change=wow_change,
                    keywords=keywords,
                    language=lang,
                    account_id=cache_account,
                )
            }
        try:
            cached, meta = _resolve_ai_payload(
                db, cache_account, "sentiment-summary", lang, _compute,
            )
            highlights = (cached or {}).get("highlights", "")
        except AIProviderError as exc:
            # Highlights is enrichment, not the whole payload — degrade in
            # place rather than failing the entire sentiment summary.
            logger.info(
                "sentiment summary highlights unavailable (%s)",
                exc.__class__.__name__,
            )
            highlights = ""
            meta = {
                "status": "degraded",
                "cached": False,
                "message": exc.user_message,
                "retry_after_hours": exc.retry_after_hours,
            }

    return {
        "success": True,
        "data": {
            "total_week": total_week,
            "total_prev_week": total_prev,
            "current_counts": current_counts,
            "previous_counts": previous_counts,
            "wow_change": wow_change,
            "keywords": keywords,
            "highlights": highlights,
            "needs_attention": needs_attention,
            "samples": samples,
        },
        "meta": meta,
    }


@router.get("/sentiment/timeline")
def sentiment_timeline(
    user: User = Depends(RequireFeature("sentiment_analysis")),
    db: Session = Depends(get_db),
):
    """Return daily sentiment counts over time, scoped to user's organization (Pro)."""

    account_ids = [
        a.id for a in db.query(SocialAccount.id).filter(
            SocialAccount.organization_id == user.organization_id,
        ).all()
    ]

    rows = (
        db.query(
            cast(Post.posted_at, Date).label("date"),
            AnalysisResult.sentiment,
            func.count(AnalysisResult.id).label("count"),
        )
        .join(Post, AnalysisResult.post_id == Post.id)
        .filter(Post.social_account_id.in_(account_ids))
        .group_by(cast(Post.posted_at, Date), AnalysisResult.sentiment)
        .order_by(cast(Post.posted_at, Date))
        .all()
    )

    # Group into { date: { positive: N, neutral: N, negative: N } }
    by_date: dict[str, dict[str, int]] = {}
    for row in rows:
        d = str(row.date)
        if d not in by_date:
            by_date[d] = {"positive": 0, "neutral": 0, "negative": 0}
        by_date[d][row.sentiment] = row.count

    timeline = [
        {"date": d, **counts} for d, counts in by_date.items()
    ]

    return {
        "success": True,
        "data": {"timeline": timeline},
    }


@router.get("/accounts")
def list_accounts(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return active social accounts for the user's organization."""
    accounts = db.query(SocialAccount).filter(
        SocialAccount.organization_id == user.organization_id,
        SocialAccount.is_active == True,
    ).all()
    return {
        "success": True,
        "data": {
            "accounts": [
                {
                    "id": str(a.id),
                    "platform": a.platform.value if a.platform else "instagram",
                    "account_name": a.username,
                }
                for a in accounts
            ],
        },
    }


@router.get("/segments")
def get_segments(
    social_account_id: str,
    user: User = Depends(RequireFeature("audience_segmentation")),
    db: Session = Depends(get_db),
):
    """Return audience segments for a social account (Pro)."""

    # Verify account belongs to user's org
    account = db.query(SocialAccount).filter(
        SocialAccount.id == social_account_id,
        SocialAccount.organization_id == user.organization_id,
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Social account not found")

    segments = (
        db.query(AudienceSegment)
        .filter(AudienceSegment.social_account_id == social_account_id)
        .order_by(AudienceSegment.cluster_id)
        .all()
    )

    return {
        "success": True,
        "data": {
            "social_account_id": social_account_id,
            "segment_count": len(segments),
            "generated_at": str(segments[0].created_at) if segments else None,
            "segments": [
                {
                    "id": str(seg.id),
                    "cluster_id": seg.cluster_id,
                    "label": seg.segment_label,
                    "size": seg.size_estimate,
                    "characteristics": seg.characteristics,
                }
                for seg in segments
            ],
        },
    }


@router.post("/segments/regenerate")
def regenerate_segments(
    social_account_id: str,
    user: User = Depends(RequireFeature("audience_segmentation")),
    db: Session = Depends(get_db),
):
    """Queue K-means segmentation for a social account (Pro)."""
    account = db.query(SocialAccount).filter(
        SocialAccount.id == social_account_id,
        SocialAccount.organization_id == user.organization_id,
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Social account not found")

    task = segment_audience.delay(social_account_id)
    return {
        "success": True,
        "data": {"task_id": task.id, "status": "queued"},
    }


@router.get("/insights")
def get_insights(
    lang: Literal["en", "ar"] = "en",
    user: User = Depends(RequireFeature("content_recommendations")),
    db: Session = Depends(get_db),
):
    """Return the latest AI-generated insight for the user's first active
    account in the requested language. One row exists per (account, language)
    — EN and AR are independent buckets."""
    account = db.query(SocialAccount).filter(
        SocialAccount.organization_id == user.organization_id,
        SocialAccount.is_active == True,
    ).first()

    if not account:
        return {"success": True, "data": None}

    insight = (
        db.query(InsightResult)
        .filter(
            InsightResult.social_account_id == account.id,
            InsightResult.language == lang,
        )
        .order_by(InsightResult.generated_at.desc())
        .first()
    )

    if not insight:
        return {"success": True, "data": None}

    return {
        "success": True,
        "data": {
            "id": str(insight.id),
            "social_account_id": str(insight.social_account_id),
            "week_start": str(insight.week_start),
            "summary": insight.summary,
            "score": insight.score,
            "score_change": insight.score_change,
            "insights": insight.insights,
            "best_post_id": str(insight.best_post_id) if insight.best_post_id else None,
            "next_best_time": insight.next_best_time,
            "language": insight.language,
            "generated_at": str(insight.generated_at),
        },
    }


@router.post("/insights/generate")
def trigger_insights(
    lang: Literal["en", "ar"] = "en",
    user: User = Depends(RequireFeature("content_recommendations")),
    db: Session = Depends(get_db),
):
    """Queue AI insight generation for the user's first active account, in the
    requested language. Overwrites that language's row; the other language's
    row is untouched."""
    account = db.query(SocialAccount).filter(
        SocialAccount.organization_id == user.organization_id,
        SocialAccount.is_active == True,
    ).first()

    if not account:
        raise HTTPException(status_code=404, detail="No active social account found")

    long_form = "Arabic" if lang == "ar" else "English"
    task = generate_weekly_insights.delay(str(account.id), long_form)
    return {
        "success": True,
        "data": {"task_id": task.id, "status": "queued"},
    }
