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

AI failures degrade gracefully — endpoints return cached-stale data with a
`meta.status="degraded"` marker (or HTTP 503 with structured body when no
cache exists), never a 500.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Callable, Literal

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.ai_degradation import (
    build_degraded_with_cache_meta,
    build_fresh_meta,
    build_stale_meta,
    degraded_no_cache_response,
)
from app.core.ai_provider import AIProviderError, get_provider
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

CACHE_TTL_HOURS = 24
CACHE_SOFT_TTL_HOURS = 24
CACHE_HARD_TTL_HOURS = 72
CACHE_CAPTION_TTL_HOURS = 24 * 7


def _cache_get(
    db: Session,
    social_account_id: str | None,
    page_name: str,
    language: str,
    ttl_hours: int = CACHE_TTL_HOURS,
) -> dict | None:
    content, _age = _cache_get_with_age(db, social_account_id, page_name, language)
    if content is None or _age is None or _age > ttl_hours:
        return None
    return content


def _cache_get_with_age(
    db: Session,
    social_account_id: str | None,
    page_name: str,
    language: str,
) -> tuple[dict | None, float | None]:
    if not social_account_id:
        return None, None
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
        return None, None
    generated = row.generated_at
    if generated.tzinfo is None:
        generated = generated.replace(tzinfo=timezone.utc)
    age_hours = (datetime.now(timezone.utc) - generated).total_seconds() / 3600.0
    return row.content, age_hours


def _cache_put(
    db: Session,
    social_account_id: str | None,
    page_name: str,
    language: str,
    content: dict,
) -> None:
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


def _background_refresh(
    social_account_id: str,
    page_name: str,
    language: str,
    compute: Callable[[], dict],
) -> None:
    """Run `compute` in a daemon thread and write the result to cache using a
    fresh DB session. AI failures are swallowed — a stale cache row stays in
    place rather than being overwritten with empty content."""
    from app.core.database import SessionLocal

    def _runner() -> None:
        try:
            fresh = compute() or {}
            if not fresh:
                return
            fresh_db = SessionLocal()
            try:
                _cache_put(fresh_db, social_account_id, page_name, language, fresh)
            finally:
                fresh_db.close()
        except AIProviderError as exc:
            logger.info(
                "SWR refresh skipped (AI %s) for page=%s account=%s",
                exc.__class__.__name__, page_name, social_account_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "SWR refresh failed for page=%s account=%s lang=%s: %s",
                page_name, social_account_id, language, exc,
            )

    threading.Thread(target=_runner, daemon=True).start()


def _resolve_ai_payload(
    db: Session,
    social_account_id: str | None,
    page_name: str,
    language: str,
    compute: Callable[[], dict],
) -> tuple[dict, dict]:
    """Stale-while-revalidate cache wrapper that also handles AI failures.

    Returns `(content, meta)`:
      - age ≤ 24h (fresh): return cached, meta=fresh.
      - 24h < age ≤ 72h: return cached, meta=stale, kick off background refresh.
      - age > 72h OR missing: try to compute; on success cache + return fresh.
        On AIProviderError, fall back to ANY cached row (regardless of age) and
        mark the response degraded. If no cache row exists at all, re-raise so
        the endpoint can return a 503.

    Background refreshes (the SWR thread) call the underlying `compute`
    directly with `source="background"` so they're rate-limit-exempt; this
    helper only orchestrates the user-facing path.
    """
    content, age_hours = _cache_get_with_age(db, social_account_id, page_name, language)
    if content is not None and age_hours is not None:
        if age_hours <= CACHE_SOFT_TTL_HOURS:
            return content, build_fresh_meta()
        if age_hours <= CACHE_HARD_TTL_HOURS and social_account_id:
            _background_refresh(social_account_id, page_name, language, compute)
            return content, build_stale_meta(age_hours)

    try:
        result = compute() or {}
    except AIProviderError as exc:
        if content is not None and age_hours is not None:
            return content, build_degraded_with_cache_meta(age_hours, exc)
        raise

    _cache_put(db, social_account_id, page_name, language, result)
    return result, build_fresh_meta()


# ── Provider helpers ──────────────────────────────────────────────────────


def _ai_available() -> bool:
    """True when at least one AI provider is configured. Used to short-circuit
    endpoints with no provider rather than dispatch a guaranteed-fail call."""
    return bool(settings.GEMINI_API_KEY) or bool(settings.OPENAI_API_KEY)


def _gemini_available() -> bool:
    """Kept for tests that monkey-patch this symbol — true when Gemini is
    configured for the page-level routes (which all use Gemini)."""
    return bool(settings.GEMINI_API_KEY)


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

_HASHTAG_RE = re.compile(r"#([^\s#.,!?…،؛؟]{2,50})", flags=re.UNICODE)
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F5FF"
    "\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF"
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
    counter: Counter[str] = Counter()
    for cap in captions:
        if not cap:
            continue
        for match in _HASHTAG_RE.findall(cap):
            counter[match.lower()] += 1
    return [f"#{tag}" for tag, _ in counter.most_common(n)]


def _emoji_usage_rate(captions: list[str]) -> float:
    non_empty = [c for c in captions if c and c.strip()]
    if not non_empty:
        return 0.0
    with_emoji = sum(1 for c in non_empty if _EMOJI_RE.search(c))
    return with_emoji / len(non_empty)


# ── Mockable shims for tests ──────────────────────────────────────────────
# Tests monkey-patch `_gemini_text` / `_gemini_json` to inject canned responses
# without touching the network. We keep them as thin wrappers around
# `get_provider("pages")` so the hot path still flows through one place.


def _gemini_text(
    system_instruction: str,
    user_message: str,
    temperature: float = 0.5,
    *,
    account_id: str | None = None,
) -> str:
    """Plain-text Gemini call. Raises `AIProviderError` on failure (no silent
    empty string) so the endpoint can decide to serve stale cache."""
    return get_provider("pages").generate_text(
        system_instruction, user_message, temperature,
        account_id=account_id, task="pages", source="user",
    )


def _gemini_json(
    system_instruction: str,
    user_message: str,
    temperature: float = 0.4,
    *,
    account_id: str | None = None,
) -> dict:
    """Structured-JSON Gemini call. Raises `AIProviderError` on failure."""
    return get_provider("pages").generate_json(
        system_instruction, user_message, temperature,
        account_id=account_id, task="pages", source="user",
    )


# ── My Posts: best post + low-performer pattern ───────────────────────────


@router.get("/posts-insights")
def posts_insights(
    language: LanguageParam = Query("en"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Top post enriched with a Gemini "why it worked" + a Gemini pattern
    across the bottom-third performers. Free for all plan tiers."""
    account_ids = _org_account_ids(db, user)
    empty = {
        "best_post": None,
        "why_it_worked": "",
        "low_performers_pattern": "",
        "what_to_change": "",
    }
    if not account_ids:
        return {"success": True, "data": empty, "meta": build_fresh_meta()}

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
        return {"success": True, "data": empty, "meta": build_fresh_meta()}

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
        return {"success": True, "data": payload, "meta": build_fresh_meta()}

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

    primary_account_id = str(account_ids[0])

    def _compute() -> dict:
        result = _gemini_json(sys, user_msg, account_id=primary_account_id) or {}
        return {
            "why_it_worked": (result.get("why_it_worked") or "").strip(),
            "low_performers_pattern": (result.get("low_performers_pattern") or "").strip(),
            "what_to_change": (result.get("what_to_change") or "").strip(),
        }

    try:
        cached, meta = _resolve_ai_payload(
            db, primary_account_id, "posts-insights", language, _compute,
        )
    except AIProviderError as exc:
        return degraded_no_cache_response(exc)

    payload["why_it_worked"] = cached.get("why_it_worked", "")
    payload["low_performers_pattern"] = cached.get("low_performers_pattern", "")
    payload["what_to_change"] = cached.get("what_to_change", "")

    return {"success": True, "data": payload, "meta": meta}


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
    """Generate a single ready-to-copy caption via OpenAI (preferred) or Gemini
    in EN or AR. AI failures return a degraded response with stale cache when
    available, else a 503."""
    provider = get_provider("captions")
    if not _ai_available():
        return {
            "success": True,
            "data": {"caption": ""},
            "meta": build_fresh_meta(),
        }

    account_ids = _org_account_ids(db, user)
    primary_account_id = str(account_ids[0]) if account_ids else None

    reference = body.reference_caption or ""
    if body.post_id and not reference and account_ids:
        post = (
            db.query(Post.caption, Post.content_type)
            .filter(Post.id == body.post_id, Post.social_account_id.in_(account_ids))
            .first()
        )
        if post:
            reference = post.caption or ""

    cache_payload = json.dumps(
        {
            "content_type": body.content_type,
            "topic": (body.topic or "").strip(),
            "post_id": body.post_id or "",
            "reference": reference[:300],
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    cache_hash = hashlib.sha256(cache_payload.encode("utf-8")).hexdigest()[:40]
    cache_page_name = f"caption:{cache_hash}"

    cached = _cache_get(
        db, primary_account_id, cache_page_name, body.language,
        ttl_hours=CACHE_CAPTION_TTL_HOURS,
    )
    if cached and cached.get("caption"):
        return {
            "success": True,
            "data": {"caption": cached["caption"]},
            "meta": build_fresh_meta(),
        }

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

    try:
        text = provider.generate_text(
            sys, user_msg, temperature=0.85,
            account_id=primary_account_id, task="captions", source="user",
        )
    except AIProviderError as exc:
        # Captions have no useful data-only fallback — entire response is AI.
        return degraded_no_cache_response(exc)

    if text and not allow_emojis:
        text = _strip_emoji(text)
    if text:
        _cache_put(db, primary_account_id, cache_page_name, body.language, {"caption": text})
    return {
        "success": True,
        "data": {"caption": text},
        "meta": build_fresh_meta(),
    }


# ── My Audience: behavior summary + what they want + best time ────────────


@router.get("/audience-insights")
def audience_insights(
    language: LanguageParam = Query("en"),
    user: User = Depends(RequireFeature("audience_segmentation")),
    db: Session = Depends(get_db),
):
    """Audience-page hero: AI summary of weekly behavior, 3 desired topics,
    and a specific best-time-to-reach with reasoning."""
    account_ids = _org_account_ids(db, user)
    empty = {
        "behavior_summary": "",
        "what_they_want": [],
        "best_time": {"day": "", "time": "", "reason": ""},
    }
    if not account_ids:
        return {"success": True, "data": empty, "meta": build_fresh_meta()}

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    post_ids_subq = (
        db.query(Post.id).filter(Post.social_account_id.in_(account_ids)).subquery()
    )

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
        return {"success": True, "data": payload, "meta": build_fresh_meta()}

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

    primary_account_id = str(account_ids[0])

    def _compute() -> dict:
        result = _gemini_json(sys, user_msg, account_id=primary_account_id) or {}
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

    try:
        cached, meta = _resolve_ai_payload(
            db, primary_account_id, "audience-insights", language, _compute,
        )
    except AIProviderError as exc:
        return degraded_no_cache_response(exc)

    payload["behavior_summary"] = cached.get("behavior_summary", "")
    payload["what_they_want"] = cached.get("what_they_want", [])
    payload["best_time"]["reason"] = cached.get("best_time_reason", "")

    return {"success": True, "data": payload, "meta": meta}


# ── Content Plan: 7-day calendar with AI topic per day ────────────────────


@router.get("/content-plan")
def content_plan(
    language: LanguageParam = Query("en"),
    user: User = Depends(RequireFeature("content_recommendations")),
    db: Session = Depends(get_db),
):
    """7-day content calendar starting today with Gemini-suggested topics."""
    account_ids = _org_account_ids(db, user)
    if not account_ids:
        return {
            "success": True,
            "data": {"days": []},
            "meta": build_fresh_meta(),
        }

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

    if not _gemini_available():
        return {"success": True, "data": {"days": days}, "meta": build_fresh_meta()}

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

    primary_account_id = str(account_ids[0])

    def _compute() -> dict:
        result = _gemini_json(
            sys, user_msg, temperature=0.7, account_id=primary_account_id,
        ) or {}
        topics_by_idx = {
            str(int(t["day_index"])): (t.get("topic") or "").strip()
            for t in (result.get("topics") or [])
            if isinstance(t, dict) and "day_index" in t
        }
        return {"topics_by_idx": topics_by_idx}

    try:
        cached, meta = _resolve_ai_payload(
            db, primary_account_id, "content-plan", language, _compute,
        )
    except AIProviderError as exc:
        return degraded_no_cache_response(exc)

    topics_by_idx = cached.get("topics_by_idx", {}) or {}
    for d in days:
        key = str(d["day_index"])
        if key in topics_by_idx:
            d["topic"] = topics_by_idx[key]

    return {"success": True, "data": {"days": days}, "meta": meta}


# ── Sentiment: suggested response templates for needs-attention posts ────


@router.get("/sentiment-responses")
def sentiment_responses(
    language: LanguageParam = Query("en"),
    user: User = Depends(RequireFeature("sentiment_analysis")),
    db: Session = Depends(get_db),
):
    """Suggested empathetic public reply templates for the top 3 posts with
    >2 negative comments. Templates produced in the requested `language`."""
    account_ids = _org_account_ids(db, user)
    if not account_ids:
        return {
            "success": True,
            "data": {"templates": []},
            "meta": build_fresh_meta(),
        }

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
        return {
            "success": True,
            "data": {"templates": []},
            "meta": build_fresh_meta(),
        }

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
            "meta": build_fresh_meta(),
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

    primary_account_id = str(account_ids[0])

    def _compute() -> dict:
        result = _gemini_json(
            sys, user_msg, temperature=0.6, account_id=primary_account_id,
        ) or {}
        templates_by_id: dict[str, str] = {}
        for t in result.get("templates") or []:
            if isinstance(t, dict) and t.get("post_id"):
                templates_by_id[str(t["post_id"])] = (t.get("response_template") or "").strip()
        return {"templates_by_id": templates_by_id}

    try:
        cached, meta = _resolve_ai_payload(
            db, primary_account_id, "sentiment-responses", language, _compute,
        )
    except AIProviderError as exc:
        return degraded_no_cache_response(exc)

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
        "meta": meta,
    }


# ── Ask Basiret: conversational Q&A grounded in the account's data ────────


def build_ask_context(db: Session, account_id: str) -> dict:
    """Assemble a structured snapshot of one account's Instagram performance.

    The same dict is injected into every Ask Basiret prompt — Gemini decides
    which fields are relevant to the user's question. Kept as a free-standing
    function (not inlined in the endpoint) so it can be unit-tested without
    spinning up FastAPI's TestClient.

    Returns an empty-ish skeleton when the account has no analyzed posts so
    the caller can short-circuit to a friendly "sync first" message instead
    of paying for a Gemini call against empty context.
    """
    now = datetime.now(timezone.utc)
    window_30d = now - timedelta(days=30)
    window_7d = now - timedelta(days=7)
    window_14d = now - timedelta(days=14)

    account = db.query(SocialAccount).filter(SocialAccount.id == account_id).first()
    username = account.username if account else None

    posts_q = db.query(Post).filter(Post.social_account_id == account_id)
    total_posts = posts_q.count()

    analyzed_count = (
        db.query(func.count(AnalysisResult.id))
        .join(Post, AnalysisResult.post_id == Post.id)
        .filter(Post.social_account_id == account_id)
        .scalar() or 0
    )

    date_range = (
        db.query(
            func.min(Post.posted_at).label("first"),
            func.max(Post.posted_at).label("last"),
        )
        .filter(Post.social_account_id == account_id)
        .first()
    )
    first_post = date_range.first.isoformat() if date_range and date_range.first else None
    last_post = date_range.last.isoformat() if date_range and date_range.last else None

    # Comment-level sentiment over last 30 days (the differentiator surface)
    sent_rows = (
        db.query(AnalysisResult.sentiment, func.count(AnalysisResult.id))
        .join(Comment, AnalysisResult.comment_id == Comment.id)
        .join(Post, Comment.post_id == Post.id)
        .filter(Post.social_account_id == account_id)
        .filter(Comment.created_at >= window_30d)
        .group_by(AnalysisResult.sentiment)
        .all()
    )
    sentiment_30d = {"positive": 0, "neutral": 0, "negative": 0}
    for label, n in sent_rows:
        if label in sentiment_30d:
            sentiment_30d[label] = int(n)
    total_sent = sum(sentiment_30d.values())

    def _pct(n: int) -> int:
        return round(100 * n / total_sent) if total_sent else 0

    sentiment_pct_30d = {
        "positive_pct": _pct(sentiment_30d["positive"]),
        "neutral_pct": _pct(sentiment_30d["neutral"]),
        "negative_pct": _pct(sentiment_30d["negative"]),
        "total_comments": total_sent,
    }

    # Top content type by avg engagement
    type_row = (
        db.query(
            Post.content_type,
            func.avg(EngagementMetric.likes + EngagementMetric.comments).label("avg_eng"),
            func.count(Post.id).label("n"),
        )
        .join(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id == account_id)
        .group_by(Post.content_type)
        .order_by(func.avg(EngagementMetric.likes + EngagementMetric.comments).desc())
        .first()
    )
    top_content_type = (
        {
            "type": type_row.content_type.value if type_row.content_type else "unknown",
            "avg_engagement": round(float(type_row.avg_eng or 0), 1),
            "post_count": int(type_row.n or 0),
        }
        if type_row
        else None
    )

    # Best posting time (dow + hour)
    best_slot = (
        db.query(
            func.extract("dow", Post.posted_at).label("dow"),
            func.extract("hour", Post.posted_at).label("hour"),
            func.avg(EngagementMetric.likes + EngagementMetric.comments).label("avg_eng"),
        )
        .join(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id == account_id)
        .group_by("dow", "hour")
        .having(func.count(Post.id) >= 1)
        .order_by(func.avg(EngagementMetric.likes + EngagementMetric.comments).desc())
        .first()
    )
    days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    best_posting_time = (
        {
            "day_of_week": days[int(best_slot.dow)],
            "hour": int(best_slot.hour),
            "avg_engagement": round(float(best_slot.avg_eng or 0), 1),
        }
        if best_slot
        else None
    )

    # 7-day vs previous-7-day average engagement per post
    def _avg_eng_in_window(start: datetime, end: datetime) -> float:
        row = (
            db.query(func.avg(EngagementMetric.likes + EngagementMetric.comments))
            .join(Post, EngagementMetric.post_id == Post.id)
            .filter(Post.social_account_id == account_id)
            .filter(Post.posted_at >= start)
            .filter(Post.posted_at < end)
            .scalar()
        )
        return round(float(row or 0), 1)

    current_avg = _avg_eng_in_window(window_7d, now)
    prev_avg = _avg_eng_in_window(window_14d, window_7d)
    change_pct = (
        round(100 * (current_avg - prev_avg) / prev_avg, 1) if prev_avg else None
    )
    engagement_trend_7d = {
        "current_7d_avg": current_avg,
        "previous_7d_avg": prev_avg,
        "change_pct": change_pct,
    }

    # Top hashtags by avg engagement (mined from captions)
    caption_rows = (
        db.query(
            Post.caption,
            (
                func.coalesce(func.sum(EngagementMetric.likes), 0)
                + func.coalesce(func.sum(EngagementMetric.comments), 0)
            ).label("eng"),
        )
        .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id == account_id)
        .filter(Post.caption.isnot(None))
        .group_by(Post.id, Post.caption)
        .all()
    )
    tag_engagement: dict[str, list[int]] = {}
    for row in caption_rows:
        if not row.caption:
            continue
        eng = int(row.eng or 0)
        for raw in _HASHTAG_RE.findall(row.caption):
            tag_engagement.setdefault(raw.lower(), []).append(eng)
    top_hashtags = sorted(
        (
            {
                "tag": f"#{tag}",
                "avg_engagement": round(sum(engs) / len(engs), 1),
                "uses": len(engs),
            }
            for tag, engs in tag_engagement.items()
        ),
        key=lambda d: d["avg_engagement"],
        reverse=True,
    )[:5]

    # Most recent 5 posts with sentiment + engagement
    recent_rows = (
        db.query(
            Post.id,
            Post.caption,
            Post.content_type,
            Post.posted_at,
            func.coalesce(func.sum(EngagementMetric.likes), 0).label("likes"),
            func.coalesce(func.sum(EngagementMetric.comments), 0).label("comments"),
            AnalysisResult.sentiment,
        )
        .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
        .outerjoin(
            AnalysisResult,
            AnalysisResult.post_id == Post.id,
        )
        .filter(Post.social_account_id == account_id)
        .group_by(Post.id, AnalysisResult.sentiment)
        .order_by(Post.posted_at.desc().nullslast())
        .limit(5)
        .all()
    )
    recent_posts = [
        {
            "content_type": r.content_type.value if r.content_type else "unknown",
            "caption_excerpt": (r.caption or "")[:100],
            "likes": int(r.likes or 0),
            "comments": int(r.comments or 0),
            "sentiment": r.sentiment or "unknown",
            "posted_at": r.posted_at.isoformat() if r.posted_at else None,
        }
        for r in recent_rows
    ]

    # Active audience segments
    seg_rows = (
        db.query(AudienceSegment)
        .filter(AudienceSegment.social_account_id == account_id)
        .order_by(AudienceSegment.size_estimate.desc().nullslast())
        .all()
    )
    audience_segments = {
        "count": len(seg_rows),
        "top_segment_label": seg_rows[0].segment_label if seg_rows else None,
    }

    return {
        "account_username": username,
        "data_window": {
            "first_post_at": first_post,
            "last_post_at": last_post,
            "total_posts": int(total_posts),
            "total_posts_analyzed": int(analyzed_count),
        },
        "sentiment_30d": sentiment_pct_30d,
        "top_content_type": top_content_type,
        "best_posting_time": best_posting_time,
        "engagement_trend_7d": engagement_trend_7d,
        "top_hashtags": top_hashtags,
        "recent_posts": recent_posts,
        "audience_segments": audience_segments,
    }


def _ask_account_has_data(context: dict) -> bool:
    """Decide whether the context is rich enough to answer questions from."""
    window = context.get("data_window") or {}
    return bool(window.get("total_posts_analyzed") or window.get("total_posts"))


def _check_ask_rate_limit(account_id: str) -> int | None:
    """Return remaining ask calls for the day, or raise a 503-payload by
    returning -1 when the limit is hit. None = limit disabled."""
    from app.core.database import SessionLocal
    from app.models.ai_usage_log import AiUsageLog

    limit = settings.AI_ASK_DAILY_LIMIT_PER_ACCOUNT
    if limit <= 0:
        return None

    session = SessionLocal()
    try:
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        used = (
            session.query(func.count(AiUsageLog.id))
            .filter(
                AiUsageLog.social_account_id == account_id,
                AiUsageLog.task == "ask",
                AiUsageLog.called_at >= since,
            )
            .scalar()
        ) or 0
    finally:
        session.close()
    return max(0, limit - int(used))


_ASK_QUESTION_MAX_CHARS = 500
_ASK_HISTORY_MAX_TURNS = 6


class AskHistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=_ASK_QUESTION_MAX_CHARS)
    language: LanguageParam = "en"
    conversation_history: list[AskHistoryTurn] = Field(default_factory=list, max_length=_ASK_HISTORY_MAX_TURNS)


@router.post("/ask")
def ask_basiret(
    body: AskRequest = Body(...),
    user: User = Depends(RequireFeature("content_recommendations")),
    db: Session = Depends(get_db),
):
    """Conversational Q&A grounded in the account's own Instagram data.

    The response always carries a `data_used` array listing which context
    buckets were injected — useful both for transparency and so the frontend
    can render "based on X, Y, Z" labels next to the answer.
    """
    account_ids = _org_account_ids(db, user)
    if not account_ids:
        return {
            "success": True,
            "data": {
                "answer": (
                    "تحتاج إلى مزامنة حساب إنستغرام أولاً قبل أن أتمكن من الإجابة على أسئلتك."
                    if body.language == "ar"
                    else "Connect and sync an Instagram account first so I have data to draw from."
                ),
                "data_used": [],
                "language": body.language,
            },
            "meta": build_fresh_meta(),
        }

    primary_account_id = str(account_ids[0])

    # Rate-limit gate (per-account, task="ask"). Mirrors the structured 503
    # used elsewhere when AI is unreachable.
    remaining = _check_ask_rate_limit(primary_account_id)
    if remaining is not None and remaining <= 0:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "data": None,
                "meta": {
                    "status": "degraded",
                    "cached": False,
                    "message": (
                        "لقد وصلت إلى الحد اليومي من الأسئلة. حاول مرة أخرى غدًا."
                        if body.language == "ar"
                        else "You've reached today's question limit. Please try again tomorrow."
                    ),
                    "retry_after_hours": 24,
                    "limit": settings.AI_ASK_DAILY_LIMIT_PER_ACCOUNT,
                },
            },
        )

    context = build_ask_context(db, primary_account_id)
    has_data = _ask_account_has_data(context)
    if not has_data:
        return {
            "success": True,
            "data": {
                "answer": (
                    "لا توجد منشورات محللة بعد. عند مزامنة منشوراتك وتحليلها، سأتمكن من الإجابة على أسئلتك حول أدائك وجمهورك."
                    if body.language == "ar"
                    else "No analyzed posts yet. Once your posts are synced and analyzed, I can answer questions about your performance and audience."
                ),
                "data_used": [],
                "language": body.language,
            },
            "meta": build_fresh_meta(),
        }

    # data_used = the keys we actually populated with non-empty values
    data_used = [
        key
        for key in (
            "data_window",
            "sentiment_30d",
            "top_content_type",
            "best_posting_time",
            "engagement_trend_7d",
            "top_hashtags",
            "recent_posts",
            "audience_segments",
        )
        if context.get(key)
    ]

    if not _ai_available():
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "data": None,
                "meta": {
                    "status": "degraded",
                    "cached": False,
                    "message": "AI service is not configured. Try again later.",
                    "retry_after_hours": None,
                },
            },
        )

    lang_label = _lang_label(body.language)
    system = (
        "You are Basiret, an AI analytics assistant for Instagram. You answer "
        "questions about the user's own Instagram account using only the data "
        "provided below.\n\n"
        "Rules:\n"
        "- Never invent numbers. If the data doesn't contain the answer, say so directly.\n"
        "- Be specific — use actual numbers from the data, not vague statements.\n"
        "- Keep answers concise — 2-5 sentences for simple questions, up to 8 for complex ones.\n"
        "- If the user asks for a recommendation, base it on patterns in the data.\n"
        "- Tone: expert but approachable. Not corporate. Not overly casual.\n"
        f"- Language: respond in {lang_label}. "
        + ("If Arabic, use Modern Standard Arabic." if body.language == "ar" else "")
        + "\n\nUser account data:\n"
        + json.dumps(context, ensure_ascii=False, default=str)
    )

    history = [
        {"role": turn.role, "content": turn.content}
        for turn in body.conversation_history
    ]

    try:
        answer = get_provider("ask").generate_chat(
            system,
            history,
            body.question,
            temperature=0.4,
            account_id=primary_account_id,
            task="ask",
            source="user",
        )
    except AIProviderError as exc:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "data": None,
                "meta": {
                    "status": "degraded",
                    "cached": False,
                    "message": exc.user_message,
                    "retry_after_hours": exc.retry_after_hours,
                },
            },
        )

    return {
        "success": True,
        "data": {
            "answer": answer,
            "data_used": data_used,
            "language": body.language,
        },
        "meta": build_fresh_meta(),
    }
