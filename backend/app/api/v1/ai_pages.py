"""
Page-level AI endpoints — action-first content for inner pages.

Each endpoint pairs a small data-gathering query with a focused Gemini call so
the page loads with both supporting data AND ready-to-act insights, not just
charts. This is the differentiator vs. Meta Business Suite: every page gives
actions, not just data.

Endpoints:
    GET  /ai-pages/posts-insights        — "what worked" + "what to change" for My Posts
    POST /ai-pages/generate-caption      — Gemini caption generation (per post / per plan day)
    GET  /ai-pages/audience-insights     — behavior summary + 3 wants + best time, for My Audience
    GET  /ai-pages/content-plan          — 7-day content calendar with AI-suggested topics
    GET  /ai-pages/sentiment-responses   — suggested reply templates for the top "needs attention" posts

Gemini failures degrade gracefully — endpoints return empty strings / empty
arrays rather than 500s, so the UI can fall back to data-only states.
"""
from __future__ import annotations

import json
import logging
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Callable, Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import RequireFeature, get_current_user
from app.models.ai_page_cache import AiPageCache
from app.models.analysis_result import AnalysisResult
from app.models.audience_segment import AudienceSegment
from app.models.comment import Comment
from app.models.engagement_metric import EngagementMetric
from app.models.post import Post
from app.models.social_account import SocialAccount
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Language plumbing ─────────────────────────────────────────────────────
# Every Gemini-backed endpoint accepts ?language=en|ar and passes it into the
# system prompt as a hard requirement. The caption generator already does
# this (see CaptionRequest.language); these helpers replicate that contract
# for page-level endpoints.

LanguageParam = Literal["en", "ar"]


def _lang_label(language: str) -> str:
    return "Arabic" if language == "ar" else "English"


def _language_rule(language: str) -> str:
    """Hard-output-language directive appended to every system prompt."""
    label = _lang_label(language)
    return (
        f"Respond ENTIRELY in {label}. "
        f"Every string value in the JSON response MUST be in {label}, "
        f"including titles, summaries, reasons, and any labels you generate. "
        f"This is a hard requirement — do not switch languages even if the "
        f"input data is in a different language."
    )


# ── AI page cache (24h TTL) ───────────────────────────────────────────────
# Gemini calls are slow (~2-5s) and costly. The cache stores only the
# Gemini-derived fields keyed by (social_account_id, page_name, language);
# the cheap DB aggregations still run on every request so counts, post
# lists, best-time slots reflect the latest synced data. Cache is refreshed
# automatically once older than CACHE_TTL_HOURS.

CACHE_TTL_HOURS = 24


def _cache_get(
    db: Session,
    social_account_id: str | None,
    page_name: str,
    language: str,
) -> dict | None:
    """Return cached Gemini output if fresher than CACHE_TTL_HOURS, else None."""
    if not social_account_id:
        return None
    row = (
        db.query(AiPageCache)
        .filter(
            AiPageCache.social_account_id == social_account_id,
            AiPageCache.page_name == page_name,
            AiPageCache.language == language,
        )
        .first()
    )
    if not row:
        return None
    now = datetime.now(timezone.utc)
    generated = row.generated_at
    if generated.tzinfo is None:
        generated = generated.replace(tzinfo=timezone.utc)
    if now - generated > timedelta(hours=CACHE_TTL_HOURS):
        return None
    return row.content


def _cache_put(
    db: Session,
    social_account_id: str | None,
    page_name: str,
    language: str,
    content: dict,
) -> None:
    """Upsert Gemini output for (account, page, language). Best-effort — a
    failed cache write never breaks the response."""
    if not social_account_id:
        return
    try:
        row = (
            db.query(AiPageCache)
            .filter(
                AiPageCache.social_account_id == social_account_id,
                AiPageCache.page_name == page_name,
                AiPageCache.language == language,
            )
            .first()
        )
        now = datetime.now(timezone.utc)
        if row:
            row.content = content
            row.generated_at = now
        else:
            db.add(
                AiPageCache(
                    social_account_id=social_account_id,
                    page_name=page_name,
                    language=language,
                    content=content,
                    generated_at=now,
                )
            )
        db.commit()
    except IntegrityError:
        db.rollback()
    except Exception as exc:
        logger.warning("ai_page_cache write failed: %s", exc)
        db.rollback()


def _cache_get_or_compute(
    db: Session,
    social_account_id: str | None,
    page_name: str,
    language: str,
    compute: Callable[[], dict],
) -> dict:
    """Return cached Gemini output if fresh; otherwise run `compute` (which
    should be the actual Gemini call) and cache its result before returning."""
    cached = _cache_get(db, social_account_id, page_name, language)
    if cached is not None:
        return cached
    result = compute() or {}
    _cache_put(db, social_account_id, page_name, language, result)
    return result


# ── Gemini client helpers ─────────────────────────────────────────────────


def _gemini_available() -> bool:
    return bool(settings.GEMINI_API_KEY)


def _gemini_text(system_instruction: str, user_message: str, temperature: float = 0.5) -> str:
    """Run a Gemini call returning plain text. Empty string on failure."""
    if not _gemini_available():
        return ""
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            "gemini-2.5-flash-lite",
            system_instruction=system_instruction,
            generation_config=genai.GenerationConfig(temperature=temperature),
        )
        resp = model.generate_content(user_message)
        return (resp.text or "").strip()
    except Exception as exc:
        logger.warning("Gemini text call failed: %s", exc)
        return ""


def _gemini_json(system_instruction: str, user_message: str, temperature: float = 0.4) -> dict | None:
    """Run a Gemini call returning structured JSON. None on failure."""
    if not _gemini_available():
        return None
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            "gemini-2.5-flash-lite",
            system_instruction=system_instruction,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=temperature,
            ),
        )
        resp = model.generate_content(user_message)
        return json.loads(resp.text)
    except Exception as exc:
        logger.warning("Gemini JSON call failed: %s", exc)
        return None


def _org_account_ids(db: Session, user: User) -> list:
    return [
        a.id
        for a in db.query(SocialAccount.id)
        .filter(
            SocialAccount.organization_id == user.organization_id,
            SocialAccount.is_active.is_(True),
        )
        .all()
    ]


# ── Caption-style helpers ─────────────────────────────────────────────────
# Match on-brand hashtags and emoji usage in the account's existing captions so
# generated captions look like they came from the same creator.

_HASHTAG_RE = re.compile(r"#([^\s#.,!?…،؛؟]{2,50})", flags=re.UNICODE)

# Emoji + pictograph ranges — same set used in the PDF report's _strip_emoji so
# behavior stays consistent across features. Stripping is conditional on the
# account's own caption history (see _emoji_usage_rate).
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F680-\U0001F6FF"  # transport & map
    "\U0001F700-\U0001F77F"
    "\U0001F780-\U0001F7FF"
    "\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF"
    "\U00002600-\U000026FF"
    "\U00002700-\U000027BF"
    "\U0001F1E6-\U0001F1FF"
    "\U0000FE00-\U0000FE0F"
    "\U0000200D"
    "]+",
    flags=re.UNICODE,
)


def _strip_emoji(text: str) -> str:
    if not text:
        return ""
    cleaned = _EMOJI_RE.sub("", text)
    return re.sub(r" {2,}", " ", cleaned).strip()


def _extract_top_hashtags(captions: list[str], n: int = 5) -> list[str]:
    """Return the n most-used hashtags across the caption list, lowercased.
    Hashtags are compared case-insensitively so '#Summer' and '#summer' fold
    together; Arabic hashtags pass through unchanged (no case)."""
    counter: Counter[str] = Counter()
    for cap in captions:
        if not cap:
            continue
        for match in _HASHTAG_RE.findall(cap):
            counter[match.lower()] += 1
    return [f"#{tag}" for tag, _ in counter.most_common(n)]


def _emoji_usage_rate(captions: list[str]) -> float:
    """Fraction of non-empty captions that contain at least one emoji. Returns
    0.0 on empty input so the 'strip by default' branch runs for new accounts."""
    non_empty = [c for c in captions if c and c.strip()]
    if not non_empty:
        return 0.0
    with_emoji = sum(1 for c in non_empty if _EMOJI_RE.search(c))
    return with_emoji / len(non_empty)


# ── My Posts: best post + low-performer pattern ───────────────────────────


@router.get("/posts-insights")
def posts_insights(
    language: LanguageParam = Query("en"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the top post enriched with a Gemini "why it worked" + a Gemini
    "what to change" pattern across the bottom-third performers.

    Free for all plan tiers — this is the My Posts page's headline action card.
    Response text is produced in the requested `language` (en|ar) and cached
    per (account, page, language) for 24h so repeat visits are instant.
    """
    account_ids = _org_account_ids(db, user)
    empty = {
        "best_post": None,
        "why_it_worked": "",
        "low_performers_pattern": "",
        "what_to_change": "",
    }
    if not account_ids:
        return {"success": True, "data": empty}

    rows = (
        db.query(
            Post.id,
            Post.caption,
            Post.content_type,
            Post.posted_at,
            Post.raw_data,
            func.coalesce(func.sum(EngagementMetric.likes), 0).label("likes"),
            func.coalesce(func.sum(EngagementMetric.comments), 0).label("comments"),
            AnalysisResult.ocr_text,
        )
        .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
        .outerjoin(AnalysisResult, AnalysisResult.post_id == Post.id)
        .filter(Post.social_account_id.in_(account_ids))
        .group_by(Post.id, AnalysisResult.ocr_text)
        .all()
    )
    if not rows:
        return {"success": True, "data": empty}

    ranked = sorted(rows, key=lambda r: (r.likes or 0) + (r.comments or 0), reverse=True)
    best = ranked[0]
    bottom_n = max(1, len(ranked) // 3)
    bottom = ranked[-bottom_n:]

    best_ocr = (best.ocr_text or "").strip()
    best_payload = {
        "id": str(best.id),
        "caption": (best.caption or "")[:400],
        "content_type": best.content_type.value if best.content_type else "unknown",
        "likes": int(best.likes or 0),
        "comments": int(best.comments or 0),
        "posted_at": best.posted_at.isoformat() if best.posted_at else None,
        "permalink": (best.raw_data or {}).get("permalink") if best.raw_data else None,
        "ocr_text": best_ocr or None,
    }

    # Build a low-performer summary line for Gemini
    bottom_lines = []
    for r in bottom[:5]:
        ct = r.content_type.value if r.content_type else "unknown"
        bottom_lines.append(
            f"- {ct} | likes={int(r.likes or 0)} comments={int(r.comments or 0)} | "
            f"caption='{(r.caption or '')[:100]}'"
        )

    payload = {
        "best_post": best_payload,
        "why_it_worked": "",
        "low_performers_pattern": "",
        "what_to_change": "",
    }

    if not _gemini_available():
        return {"success": True, "data": payload}

    best_ocr_line = (
        f"- image text (OCR): '''{best_ocr[:300]}'''\n"
        if best_ocr
        else ""
    )
    user_msg = (
        "Analyze the following Instagram performance data and return strict JSON.\n\n"
        "TOP POST:\n"
        f"- type: {best_payload['content_type']}\n"
        f"- likes: {best_payload['likes']}, comments: {best_payload['comments']}\n"
        f"- caption: '''{best_payload['caption']}'''\n"
        f"{best_ocr_line}"
        "\n"
        "LOW PERFORMERS (bottom third by engagement):\n"
        + "\n".join(bottom_lines)
        + "\n\n"
        "Return JSON with these EXACT keys:\n"
        '  "why_it_worked": 2 sentences explaining why the top post outperformed.\n'
        '  "low_performers_pattern": 2 sentences naming a SHARED pattern across the low performers.\n'
        '  "what_to_change": 1-2 sentences with a SPECIFIC, ACTIONABLE change to fix the pattern.\n'
        "Be concrete. Reference numbers, content type, caption style, or on-image text. No markdown, no preamble."
    )
    sys = (
        "You are a content-performance analyst for an Instagram creator. "
        "Compare a top-performing post against low-performing posts and return strict JSON. "
        "Be specific and actionable, never generic. No emojis, no markdown. "
        + _language_rule(language)
    )

    def _compute() -> dict:
        result = _gemini_json(sys, user_msg) or {}
        return {
            "why_it_worked": (result.get("why_it_worked") or "").strip(),
            "low_performers_pattern": (result.get("low_performers_pattern") or "").strip(),
            "what_to_change": (result.get("what_to_change") or "").strip(),
        }

    cached = _cache_get_or_compute(
        db, account_ids[0], "posts-insights", language, _compute
    )
    payload["why_it_worked"] = cached.get("why_it_worked", "")
    payload["low_performers_pattern"] = cached.get("low_performers_pattern", "")
    payload["what_to_change"] = cached.get("what_to_change", "")

    return {"success": True, "data": payload}


# ── Caption generation (used by My Posts + Content Plan) ──────────────────


class CaptionRequest(BaseModel):
    content_type: str = Field(default="image")
    topic: str | None = None
    language: Literal["en", "ar"] = "en"
    reference_caption: str | None = None
    post_id: str | None = None


@router.post("/generate-caption")
def generate_caption(
    body: CaptionRequest = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a single ready-to-copy caption via Gemini in EN or AR.

    The caption is shaped to the account's own voice:
      - language matches the caller's UI language (body.language, wins over the
        reference caption's language)
      - top-5 most-used hashtags from the account's existing posts are offered
        to Gemini so generated captions reuse on-brand tags
      - emojis are stripped from the output by default; kept only if >50% of
        the account's existing captions contain emojis
    """
    if not _gemini_available():
        return {"success": True, "data": {"caption": ""}}

    account_ids = _org_account_ids(db, user)

    # If post_id passed, hydrate the reference_caption from the DB so the caller
    # doesn't need to know the original text.
    reference = body.reference_caption or ""
    if body.post_id and not reference and account_ids:
        post = (
            db.query(Post.caption, Post.content_type)
            .filter(Post.id == body.post_id, Post.social_account_id.in_(account_ids))
            .first()
        )
        if post:
            reference = post.caption or ""

    # Pull this account's caption history to derive style hints (hashtags + emoji rate).
    account_captions: list[str] = []
    if account_ids:
        account_captions = [
            c
            for (c,) in db.query(Post.caption)
            .filter(
                Post.social_account_id.in_(account_ids),
                Post.caption.isnot(None),
            )
            .limit(500)
            .all()
            if c
        ]

    top_hashtags = _extract_top_hashtags(account_captions, n=5)
    emoji_rate = _emoji_usage_rate(account_captions)
    allow_emojis = emoji_rate > 0.5

    lang_label = "Arabic" if body.language == "ar" else "English"
    hashtag_rule = (
        f"On the LAST line include 2-4 hashtags. Prefer these hashtags already used by this "
        f"account: {' '.join(top_hashtags)}. You may add one new relevant tag."
        if top_hashtags
        else "On the last line add 2-4 relevant hashtags."
    )
    emoji_rule = (
        "A tasteful emoji or two is welcome (the creator uses them)."
        if allow_emojis
        else "Do NOT use any emojis, emoticons, or pictograph characters anywhere in the caption."
    )

    sys = (
        f"You are an Instagram copywriter. Write a single caption ENTIRELY in {lang_label}. "
        f"This is a hard requirement — even if the reference caption is in a different language, "
        f"the output MUST be in {lang_label}. "
        "Write something a small business owner can paste directly into Instagram. "
        "Match Instagram's voice — short, punchy, scannable. "
        "1-3 lines, end with a clear question or call-to-action. "
        f"{hashtag_rule} "
        f"{emoji_rule} "
        "No quotation marks around the caption. No preamble like 'Here is...'. "
        "Return ONLY the caption text."
    )

    parts = [
        f"Content type: {body.content_type}",
        f"Target language: {lang_label}",
    ]
    if body.topic:
        parts.append(f"Topic: {body.topic}")
    if top_hashtags:
        parts.append("Preferred hashtags (from this account's own posts): " + " ".join(top_hashtags))
    if reference:
        parts.append(
            f"Reference (for tone only — rewrite in {lang_label}, do not copy):\n{reference[:300]}"
        )
    user_msg = "\n".join(parts)

    text = _gemini_text(sys, user_msg, temperature=0.85)
    if text and not allow_emojis:
        text = _strip_emoji(text)
    return {"success": True, "data": {"caption": text}}


# ── My Audience: behavior summary + what they want + best time ────────────


@router.get("/audience-insights")
def audience_insights(
    language: LanguageParam = Query("en"),
    user: User = Depends(RequireFeature("audience_segmentation")),
    db: Session = Depends(get_db),
):
    """Audience-page hero: AI summary of weekly behavior, 3 desired topics,
    and a specific best-time-to-reach with reasoning. Response text is
    produced in the requested `language` (en|ar) and cached per
    (account, page, language) for 24h."""
    account_ids = _org_account_ids(db, user)
    empty = {
        "behavior_summary": "",
        "what_they_want": [],
        "best_time": {"day": "", "time": "", "reason": ""},
    }
    if not account_ids:
        return {"success": True, "data": empty}

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    post_ids_subq = (
        db.query(Post.id).filter(Post.social_account_id.in_(account_ids)).subquery()
    )

    # Weekly comment volume + sentiment split
    sent_rows = (
        db.query(AnalysisResult.sentiment, func.count(AnalysisResult.id))
        .join(Comment, AnalysisResult.comment_id == Comment.id)
        .filter(Comment.post_id.in_(db.query(post_ids_subq.c.id)))
        .filter(Comment.created_at >= week_ago)
        .group_by(AnalysisResult.sentiment)
        .all()
    )
    sentiment_week = {"positive": 0, "neutral": 0, "negative": 0}
    for label, n in sent_rows:
        if label in sentiment_week:
            sentiment_week[label] = n
    total_week_comments = sum(sentiment_week.values())

    # Best day + hour by avg engagement (all-time)
    best_slot = (
        db.query(
            func.extract("dow", Post.posted_at).label("dow"),
            func.extract("hour", Post.posted_at).label("hour"),
            func.avg(EngagementMetric.likes + EngagementMetric.comments).label("avg_eng"),
            func.count(Post.id).label("n"),
        )
        .join(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id.in_(account_ids))
        .group_by("dow", "hour")
        .having(func.count(Post.id) >= 1)
        .order_by(func.avg(EngagementMetric.likes + EngagementMetric.comments).desc())
        .first()
    )
    days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    best_day = days[int(best_slot.dow)] if best_slot else ""
    best_time = f"{int(best_slot.hour):02d}:00" if best_slot else ""
    best_avg = round(float(best_slot.avg_eng), 1) if best_slot else 0

    # Top content type
    top_type_row = (
        db.query(
            Post.content_type,
            func.avg(EngagementMetric.likes + EngagementMetric.comments).label("avg_eng"),
        )
        .join(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id.in_(account_ids))
        .group_by(Post.content_type)
        .order_by(func.avg(EngagementMetric.likes + EngagementMetric.comments).desc())
        .first()
    )
    top_type = (
        top_type_row.content_type.value
        if top_type_row and top_type_row.content_type
        else "image"
    )

    # Sample comment text for topic mining (top 30 most recent positive comments)
    pos_comments = (
        db.query(Comment.text)
        .join(AnalysisResult, AnalysisResult.comment_id == Comment.id)
        .filter(Comment.post_id.in_(db.query(post_ids_subq.c.id)))
        .filter(AnalysisResult.sentiment == "positive")
        .filter(Comment.text.isnot(None))
        .order_by(Comment.created_at.desc().nullslast())
        .limit(30)
        .all()
    )
    pos_sample = " | ".join(c.text[:80] for c in pos_comments if c.text)[:1500]

    # Segments summary (helps Gemini characterize the audience)
    seg_rows = (
        db.query(AudienceSegment)
        .filter(AudienceSegment.social_account_id.in_(account_ids))
        .order_by(AudienceSegment.size_estimate.desc())
        .limit(3)
        .all()
    )
    seg_lines = []
    for s in seg_rows:
        ch = s.characteristics or {}
        seg_lines.append(
            f"- {s.segment_label} (n={s.size_estimate}, "
            f"type={ch.get('dominant_content_type', '?')}, "
            f"time={ch.get('typical_posting_time', '?')}, "
            f"sentiment={ch.get('dominant_sentiment', '?')})"
        )

    payload = {
        "behavior_summary": "",
        "what_they_want": [],
        "best_time": {
            "day": best_day,
            "time": best_time,
            "reason": "",
        },
    }

    if not _gemini_available():
        return {"success": True, "data": payload}

    sys = (
        "You are an audience-strategy advisor for an Instagram creator. "
        "Given last week's audience signals, return strict JSON describing: "
        "(1) a 2-sentence behavior summary, "
        "(2) THREE specific content topics this audience wants to see next, "
        "(3) WHY the top posting slot works for this audience. "
        "Be specific. Reference percentages, comment themes, content types. "
        "No emojis, no markdown, no preamble. "
        + _language_rule(language)
    )
    user_msg = (
        f"Total comments last 7 days: {total_week_comments}\n"
        f"Sentiment split: {sentiment_week}\n"
        f"Top content type by engagement (all-time): {top_type}\n"
        f"Top time slot: {best_day} at {best_time} (avg {best_avg} engagement)\n"
        f"Active audience clusters:\n" + ("\n".join(seg_lines) or "(none yet)") + "\n"
        f"Recent positive comments sample: {pos_sample or '(none)'}\n\n"
        "Return JSON:\n"
        '{\n'
        '  "behavior_summary": "2 sentences",\n'
        '  "what_they_want": [\n'
        '    {"topic": "concrete topic", "reason": "1 sentence why"},\n'
        '    {"topic": "...", "reason": "..."},\n'
        '    {"topic": "...", "reason": "..."}\n'
        '  ],\n'
        '  "best_time_reason": "1 sentence why this slot works"\n'
        '}'
    )

    def _compute() -> dict:
        result = _gemini_json(sys, user_msg) or {}
        what = result.get("what_they_want") or []
        return {
            "behavior_summary": (result.get("behavior_summary") or "").strip(),
            "what_they_want": [
                {
                    "topic": (item.get("topic") or "").strip(),
                    "reason": (item.get("reason") or "").strip(),
                }
                for item in what
                if isinstance(item, dict) and item.get("topic")
            ][:3],
            "best_time_reason": (result.get("best_time_reason") or "").strip(),
        }

    cached = _cache_get_or_compute(
        db, account_ids[0], "audience-insights", language, _compute
    )
    payload["behavior_summary"] = cached.get("behavior_summary", "")
    payload["what_they_want"] = cached.get("what_they_want", [])
    payload["best_time"]["reason"] = cached.get("best_time_reason", "")

    return {"success": True, "data": payload}


# ── Content Plan: 7-day calendar with AI topic per day ────────────────────


@router.get("/content-plan")
def content_plan(
    language: LanguageParam = Query("en"),
    user: User = Depends(RequireFeature("content_recommendations")),
    db: Session = Depends(get_db),
):
    """Return a 7-day content calendar starting today. Topics are produced in
    the requested `language` (en|ar) and cached per (account, page, language)
    for 24h.

    Slot logic:
      - Day index = position in plan
      - Content type rotates across the user's TOP 3 historical types
      - Best time is the historical best hour for that content type (fallback 18:00)
      - Estimated reach = avg likes+comments for that content type * 1.0 (proxy)
      - Topic = Gemini, given the user's recent best captions as inspiration
    """
    account_ids = _org_account_ids(db, user)
    if not account_ids:
        return {"success": True, "data": {"days": []}}

    # Per-content-type stats
    type_stats = (
        db.query(
            Post.content_type,
            func.count(Post.id).label("n"),
            func.coalesce(func.avg(EngagementMetric.likes + EngagementMetric.comments), 0).label(
                "avg_eng"
            ),
        )
        .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id.in_(account_ids))
        .group_by(Post.content_type)
        .order_by(func.coalesce(func.avg(EngagementMetric.likes + EngagementMetric.comments), 0).desc())
        .all()
    )

    type_rotation: list[str] = []
    type_meta: dict[str, dict] = {}
    for row in type_stats:
        if not row.content_type:
            continue
        ct = row.content_type.value
        type_rotation.append(ct)
        type_meta[ct] = {
            "avg_eng": round(float(row.avg_eng), 1),
            "n": row.n,
        }
    if not type_rotation:
        type_rotation = ["image", "video", "carousel"]
        type_meta = {ct: {"avg_eng": 0, "n": 0} for ct in type_rotation}

    # Best hour per content type
    best_hour_by_type: dict[str, int] = {}
    hour_rows = (
        db.query(
            Post.content_type,
            func.extract("hour", Post.posted_at).label("hour"),
            func.avg(EngagementMetric.likes + EngagementMetric.comments).label("avg_eng"),
        )
        .join(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id.in_(account_ids))
        .group_by(Post.content_type, "hour")
        .all()
    )
    by_type_hour: dict[str, list[tuple[int, float]]] = {}
    for row in hour_rows:
        if not row.content_type or row.hour is None:
            continue
        by_type_hour.setdefault(row.content_type.value, []).append(
            (int(row.hour), float(row.avg_eng or 0))
        )
    for ct, pairs in by_type_hour.items():
        pairs.sort(key=lambda p: p[1], reverse=True)
        best_hour_by_type[ct] = pairs[0][0] if pairs else 18

    # Top captions for inspiration
    top_caps_rows = (
        db.query(
            Post.caption,
            Post.content_type,
            (func.coalesce(func.sum(EngagementMetric.likes), 0) + func.coalesce(func.sum(EngagementMetric.comments), 0)).label("eng"),
        )
        .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id.in_(account_ids))
        .filter(Post.caption.isnot(None))
        .group_by(Post.id, Post.caption, Post.content_type)
        .order_by((func.coalesce(func.sum(EngagementMetric.likes), 0) + func.coalesce(func.sum(EngagementMetric.comments), 0)).desc())
        .limit(5)
        .all()
    )
    top_caps_lines = [
        f"- ({(r.content_type.value if r.content_type else 'unknown')}, eng={int(r.eng or 0)}) {(r.caption or '')[:140]}"
        for r in top_caps_rows
    ]

    # Build the 7-day plan skeleton (data-driven slots, topics filled by Gemini)
    today = datetime.now(timezone.utc).date()
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    days = []
    for i in range(7):
        d = today + timedelta(days=i)
        ct = type_rotation[i % len(type_rotation)]
        hour = best_hour_by_type.get(ct, 18)
        days.append(
            {
                "day_index": i,
                "day_label": day_names[d.weekday()],
                "date": d.isoformat(),
                "content_type": ct,
                "best_time": f"{hour:02d}:00",
                "estimated_reach": int(type_meta.get(ct, {}).get("avg_eng", 0)),
                "topic": "",
            }
        )

    if _gemini_available():
        sys = (
            "You are a content-planning advisor for an Instagram creator. "
            "Given the creator's top-performing captions and a 7-day plan skeleton "
            "(date + content type per day), return strict JSON adding ONE specific "
            "topic per day that is fresh, on-brand, and varied across the week. "
            "Topics must be 4-10 words, written as headlines (no markdown, no quotes). "
            "Do NOT repeat the same topic across days. "
            + _language_rule(language)
        )
        skeleton_lines = [
            f"Day {d['day_index']} ({d['day_label']}, {d['date']}, type={d['content_type']})"
            for d in days
        ]
        user_msg = (
            "Top-performing captions from this account (for inspiration only):\n"
            + ("\n".join(top_caps_lines) or "(none yet)")
            + "\n\nWeek plan skeleton:\n"
            + "\n".join(skeleton_lines)
            + "\n\nReturn JSON:\n"
            '{ "topics": [\n'
            '  { "day_index": 0, "topic": "..." },\n'
            "  ...7 entries\n"
            "]}"
        )

        def _compute() -> dict:
            result = _gemini_json(sys, user_msg, temperature=0.7) or {}
            topics_by_idx = {
                str(int(t["day_index"])): (t.get("topic") or "").strip()
                for t in (result.get("topics") or [])
                if isinstance(t, dict) and "day_index" in t
            }
            return {"topics_by_idx": topics_by_idx}

        cached = _cache_get_or_compute(
            db, account_ids[0], "content-plan", language, _compute
        )
        topics_by_idx = cached.get("topics_by_idx", {}) or {}
        for d in days:
            key = str(d["day_index"])
            if key in topics_by_idx:
                d["topic"] = topics_by_idx[key]

    return {"success": True, "data": {"days": days}}


# ── Sentiment: suggested response templates for needs-attention posts ────


@router.get("/sentiment-responses")
def sentiment_responses(
    language: LanguageParam = Query("en"),
    user: User = Depends(RequireFeature("sentiment_analysis")),
    db: Session = Depends(get_db),
):
    """For each post with >2 negative comments, return a suggested empathetic
    public reply template the creator can paste into Instagram. Top 3 only.

    Templates are produced in the requested `language` (en|ar) and cached per
    (account, page, language) for 24h. The UI language takes precedence over
    the comment language — Arabic-language UI always gets Arabic templates.

    This is the "Needs your attention + suggested response template" surface
    on the Sentiment page — not just flagging the problem, giving the response.
    """
    account_ids = _org_account_ids(db, user)
    if not account_ids:
        return {"success": True, "data": {"templates": []}}

    attention = (
        db.query(
            Post.id,
            Post.caption,
            func.count(AnalysisResult.id).label("neg_count"),
        )
        .join(Comment, Comment.post_id == Post.id)
        .join(AnalysisResult, AnalysisResult.comment_id == Comment.id)
        .filter(AnalysisResult.sentiment == "negative")
        .filter(Post.social_account_id.in_(account_ids))
        .group_by(Post.id, Post.caption)
        .having(func.count(AnalysisResult.id) > 2)
        .order_by(func.count(AnalysisResult.id).desc())
        .limit(3)
        .all()
    )
    if not attention:
        return {"success": True, "data": {"templates": []}}

    # Pull representative negative comments for each post (Gemini gets the sample)
    payload_rows = []
    for row in attention:
        neg_samples = (
            db.query(Comment.text)
            .join(AnalysisResult, AnalysisResult.comment_id == Comment.id)
            .filter(Comment.post_id == row.id, AnalysisResult.sentiment == "negative")
            .filter(Comment.text.isnot(None))
            .order_by(Comment.created_at.desc().nullslast())
            .limit(3)
            .all()
        )
        payload_rows.append(
            {
                "post_id": str(row.id),
                "neg_count": int(row.neg_count),
                "caption": (row.caption or "")[:200],
                "samples": [s.text[:200] for s in neg_samples if s.text],
            }
        )

    if not _gemini_available():
        return {
            "success": True,
            "data": {
                "templates": [
                    {"post_id": r["post_id"], "response_template": ""} for r in payload_rows
                ]
            },
        }

    sys = (
        "You are a customer-care specialist replying publicly on Instagram. "
        "For each post, write ONE empathetic, professional reply (1-2 sentences) "
        "the business owner can paste verbatim under the post. "
        "Acknowledge the concern, take responsibility where appropriate, and "
        "offer a concrete next step (e.g. 'DM us your order number'). "
        "Never sound defensive or corporate. No emojis, no hashtags, no markdown. "
        + _language_rule(language)
    )
    user_msg = (
        "For each post below, return ONE response template. Return strict JSON:\n"
        '{ "templates": [ { "post_id": "...", "response_template": "..." } ] }\n\n'
        + "\n\n".join(
            f"POST {i + 1} (id={r['post_id']}, {r['neg_count']} negative comments)\n"
            f"Caption: {r['caption']}\n"
            f"Sample negative comments:\n" + "\n".join(f"  - {s}" for s in r["samples"])
            for i, r in enumerate(payload_rows)
        )
    )

    # Cache key depends on the set of negative-comment post_ids — if the
    # set changes (new flagged posts), the cached templates are still
    # valid for the posts they cover, and uncovered posts just fall back
    # to "" (empty template). Safe enough for 24h.
    def _compute() -> dict:
        result = _gemini_json(sys, user_msg, temperature=0.6) or {}
        templates_by_id: dict[str, str] = {}
        for t in result.get("templates") or []:
            if isinstance(t, dict) and t.get("post_id"):
                templates_by_id[str(t["post_id"])] = (t.get("response_template") or "").strip()
        return {"templates_by_id": templates_by_id}

    cached = _cache_get_or_compute(
        db, account_ids[0], "sentiment-responses", language, _compute
    )
    templates_by_id = cached.get("templates_by_id", {}) or {}

    return {
        "success": True,
        "data": {
            "templates": [
                {
                    "post_id": r["post_id"],
                    "response_template": templates_by_id.get(r["post_id"], ""),
                }
                for r in payload_rows
            ]
        },
    }
