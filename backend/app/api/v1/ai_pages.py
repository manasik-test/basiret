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
from datetime import date as _date, datetime, timedelta, timezone
from typing import Callable, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
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
from app.core.deps import RequireFeature, get_current_user, require_admin_or_manager
from app.models.scheduled_post import ScheduledPost
from app.models.ai_page_cache import AiPageCache
from app.models.analysis_result import AnalysisResult
from app.models.audience_segment import AudienceSegment
from app.models.comment import Comment
from app.models.engagement_metric import EngagementMetric
from app.models.organization import Organization
from app.models.post import Post
from app.models.social_account import SocialAccount
from app.models.user import User
from app.core.brand_context import format_brand_identity
from app.tasks.insights import format_business_profile

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Language plumbing ─────────────────────────────────────────────────────

LanguageParam = Literal["en", "ar"]


def _lang_label(language: str) -> str:
    return "Arabic" if language == "ar" else "English"


def _language_rule(language: str) -> str:
    """Hard-output-language directive appended to every system prompt.

    Provider-level langdetect (ai_provider._check_language_compliance) catches
    violations and retries once with a stronger directive, but a precise
    system-prompt rule reduces the violation rate in the first place — fewer
    retries = lower latency and Gemini cost. The negative example below was
    added 2026-05-15 after a real production incident where an account with
    Arabic captions had Arabic AI prose cached under the English language key.
    """
    label = _lang_label(language)
    other = "Arabic" if label == "English" else "English"
    return (
        f"Respond ENTIRELY in {label}. Every string value in the JSON response "
        f"MUST be in {label}, including titles, summaries, reasons, and any "
        f"labels you generate. If captions, comments, or other source data are "
        f"in {other}, you MUST still respond in {label}. Translating "
        f"cross-language content into {label} is correct; copying {other} "
        f"content into the JSON is forbidden."
    )


def _business_profile_for_account(db: Session, account_id: str | None) -> dict | None:
    """Fetch the organization's business_profile for a given social account.

    Returns None when the profile is unset or the account is missing — callers
    pass the result through `format_business_profile` which already handles
    None gracefully.
    """
    if not account_id:
        return None
    row = (
        db.query(Organization.business_profile)
        .join(SocialAccount, SocialAccount.organization_id == Organization.id)
        .filter(SocialAccount.id == account_id)
        .first()
    )
    return row[0] if row else None


def _business_context_block(profile: dict | None) -> str:
    """Build the BUSINESS CONTEXT line that gets prepended to user messages."""
    line = format_business_profile(profile)
    return f"BUSINESS CONTEXT: {line}\n\n" if line else ""


def _organization_id_for_account(db: Session, account_id: str | None):
    """Look up the organization_id that owns a given social account.

    Used to source brand identity, which is org-scoped. Returns None when the
    account is missing so the brand-context block degrades to empty.
    """
    if not account_id:
        return None
    row = (
        db.query(SocialAccount.organization_id)
        .filter(SocialAccount.id == account_id)
        .first()
    )
    return row[0] if row else None


def _brand_context_block(db: Session, account_id: str | None) -> str:
    """Build the BRAND IDENTITY block for prompt injection.

    Layered AFTER the BUSINESS CONTEXT block — business says *what* the
    creator does, brand says *how* they sound. Empty string when the org has
    no brand identity saved, so callers can concatenate unconditionally.
    """
    org_id = _organization_id_for_account(db, account_id)
    return format_brand_identity(org_id, db)


_BUSINESS_TAILORING_RULE = (
    " If a BUSINESS CONTEXT line is provided, every recommendation must be "
    "specific to that industry, city, and audience language — a restaurant in "
    "Dubai expects food-styling and local-hashtag advice; a fashion brand in "
    "Cairo expects styling reels and culturally relevant trends. Generic "
    "advice that ignores the business context is a failure."
)


# ── Content-plan: anti-template guardrails ────────────────────────────────
#
# Without strong brand context, Gemini tends to fall back to generic weekday
# templates ("Monday Motivation", "Throwback Thursday") instead of producing
# topics anchored to the creator's actual industry. Three layers of defence:
#   1. A forbidden-patterns rule injected into the system prompt up-front.
#   2. A regex scan over Gemini's output. On hit → one retry with a stronger
#      directive appended to the system prompt.
#   3. If the retry STILL returns a forbidden topic, substitute that slot with
#      a deterministic fallback drawn from the org's content_pillars.

_FORBIDDEN_WEEKDAY_RULE = (
    " FORBIDDEN PATTERNS: Do NOT use generic weekday templates "
    "(e.g. 'Monday Motivation', 'Throwback Thursday', 'Fun Friday', "
    "'Sunday Reflections', 'Weekend Vibes', 'Motivation Monday'). "
    "Every topic must be specific to this account's industry, location, "
    "and content patterns. A weekday template is a failure."
)

_RETRY_DIRECTIVE = (
    " CRITICAL: Your previous response included a generic weekday template "
    "(e.g. 'Monday Motivation'). This is forbidden. Every topic must be "
    "directly tied to this account's industry and content patterns. "
    "Replace the offending entry with a specific, on-brand topic."
)

FORBIDDEN_WEEKDAY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\b(monday motivation|motivation monday)\b", re.I),
    re.compile(r"\b(throwback thursday|tbt)\b", re.I),
    re.compile(r"\b(fun friday|friday feels)\b", re.I),
    re.compile(r"\b(sunday (reflections?|funday|vibes))\b", re.I),
    re.compile(r"\b(weekend vibes|weekend mood)\b", re.I),
    re.compile(r"\b(saturday selfie|self-?care saturday)\b", re.I),
    re.compile(r"\b(wisdom wednesday|wellness wednesday)\b", re.I),
    re.compile(r"\b(transformation tuesday)\b", re.I),
]

_GENERIC_FALLBACK_TOPIC = "Share an update from your business"


def _topic_has_forbidden_pattern(topic: str | None) -> bool:
    if not topic:
        return False
    return any(p.search(topic) for p in FORBIDDEN_WEEKDAY_PATTERNS)


def _pillar_fallback(day_index: int, pillars: list[str]) -> str:
    """Deterministic per-day-index fallback drawn from content_pillars.

    Cycles through pillars when fewer than 7 are provided; falls back to a
    generic placeholder when the org has no pillars saved.
    """
    cleaned = [p for p in (pillars or []) if isinstance(p, str) and p.strip()]
    if not cleaned:
        return _GENERIC_FALLBACK_TOPIC
    return cleaned[day_index % len(cleaned)]


# ── Inferred-context fallback (when brand identity is unset) ──────────────
#
# When BOTH business_profile and brand_identity are NULL we have no real
# anchor — Gemini will reach for weekday templates by default. Mine the
# top-performing captions for a soft signal: dominant language, location
# hashtags, repeated content tokens. This is intentionally weak — it stops
# being used the moment the creator fills the Brand Identity tab.

_INFERRED_LOCATION_TERMS: dict[str, str] = {
    # English / transliteration
    "muscat": "Muscat, Oman",
    "oman": "Oman",
    "riyadh": "Riyadh, Saudi Arabia",
    "jeddah": "Jeddah, Saudi Arabia",
    "saudi": "Saudi Arabia",
    "dubai": "Dubai, UAE",
    "abu dhabi": "Abu Dhabi, UAE",
    "uae": "UAE",
    "cairo": "Cairo, Egypt",
    "doha": "Doha, Qatar",
    "kuwait": "Kuwait",
    "amman": "Amman, Jordan",
    "beirut": "Beirut, Lebanon",
    # Arabic
    "مسقط": "Muscat, Oman",
    "الرياض": "Riyadh, Saudi Arabia",
    "جدة": "Jeddah, Saudi Arabia",
    "السعودية": "Saudi Arabia",
    "دبي": "Dubai, UAE",
    "أبوظبي": "Abu Dhabi, UAE",
    "ابوظبي": "Abu Dhabi, UAE",
    "الإمارات": "UAE",
    "الامارات": "UAE",
    "القاهرة": "Cairo, Egypt",
    "الدوحة": "Doha, Qatar",
    "الكويت": "Kuwait",
    "بيروت": "Beirut, Lebanon",
}

_INFERRED_STOPWORDS: set[str] = {
    # English
    "the", "and", "for", "are", "with", "from", "this", "that", "your",
    "you", "our", "but", "not", "all", "any", "can", "out", "now", "get",
    "has", "have", "had", "was", "were", "will", "just", "more", "one",
    "two", "new", "use", "see", "his", "her", "him", "she", "they",
    "https", "http", "www", "com",
    # Arabic
    "في", "من", "إلى", "الى", "على", "عن", "هو", "هي", "ما", "ماذا", "كيف",
    "أو", "او", "ثم", "كل", "بعض", "هذا", "هذه", "ذلك", "تلك", "أن", "ان",
    "أنا", "انا", "نحن", "أنت", "انت", "هم", "هن", "كان", "كانت", "هل",
    "مع", "بعد", "قبل", "عند", "حتى",
}


def _infer_context_from_captions(captions: list[str]) -> str:
    """Build a soft INFERRED CONTEXT block from a sample of captions.

    Returns "" when there is no usable signal (no captions). The output is
    deliberately one short paragraph so it nests below real BUSINESS / BRAND
    blocks without dominating the prompt.
    """
    cleaned = [c for c in captions if c]
    if not cleaned:
        return ""
    text = "\n".join(cleaned)

    ar_chars = sum(1 for ch in text if "؀" <= ch <= "ۿ")
    en_chars = sum(1 for ch in text if ch.isascii() and ch.isalpha())
    if ar_chars > en_chars * 2:
        language = "Arabic"
    elif en_chars > ar_chars * 2:
        language = "English"
    else:
        language = "a mix of Arabic and English"

    lowered = text.lower()
    location: str | None = None
    for term, label in _INFERRED_LOCATION_TERMS.items():
        if term in lowered:
            location = label
            break

    tokens = re.findall(r"[\w؀-ۿ]+", text.lower())
    counts: Counter[str] = Counter()
    for tok in tokens:
        if len(tok) < 4 or tok.isdigit() or tok in _INFERRED_STOPWORDS:
            continue
        counts[tok] += 1
    top_nouns = [t for t, _ in counts.most_common(3)]

    parts = [f"Account posts primarily in {language}"]
    if top_nouns:
        parts.append(f"content theme appears to be {', '.join(top_nouns)}")
    if location:
        parts.append(f"posts from {location}")
    body = ", ".join(parts) + "."
    return "INFERRED CONTEXT (no brand identity set yet):\n" + body + "\n\n"


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
    language: str | None = None,
) -> str:
    """Plain-text Gemini call. Raises `AIProviderError` on failure (no silent
    empty string) so the endpoint can decide to serve stale cache.

    Passing `language` (`'en'` or `'ar'`) opts into the provider-level
    compliance check + retry. Recommended for every prose-producing call
    site — provider falls back to the original response if both attempts
    violate, so the worst case is "same behavior as before".
    """
    return get_provider("pages").generate_text(
        system_instruction, user_message, temperature,
        account_id=account_id, task="pages", source="user",
        language=language,
    )


def _gemini_json(
    system_instruction: str,
    user_message: str,
    temperature: float = 0.4,
    *,
    account_id: str | None = None,
    language: str | None = None,
) -> dict:
    """Structured-JSON Gemini call. Raises `AIProviderError` on failure."""
    return get_provider("pages").generate_json(
        system_instruction, user_message, temperature,
        account_id=account_id, task="pages", source="user",
        language=language,
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
    primary_account_id = str(account_ids[0])
    bp = _business_profile_for_account(db, primary_account_id)
    user_msg = (
        "Analyze the following Instagram performance data and return strict JSON.\n\n"
        + _business_context_block(bp)
        + _brand_context_block(db, primary_account_id)
        + "TOP POST:\n"
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
        "Be specific and actionable, never generic. No emojis, no markdown."
        + _BUSINESS_TAILORING_RULE
        + " "
        + _language_rule(language)
    )

    def _compute() -> dict:
        result = _gemini_json(sys, user_msg, account_id=primary_account_id, language=language) or {}
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
        # best_post is data we already computed from the DB — don't lose it just
        # because the AI couldn't write the accompanying prose. Surface the
        # degraded state in meta so the UI can flag it, but render the post.
        return {
            "success": True,
            "data": payload,
            "meta": {
                "status": "degraded",
                "cached": False,
                "message": exc.user_message,
                "retry_after_hours": exc.retry_after_hours,
            },
        }

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
    # Aspect ratio of the image/video this caption accompanies. Square posts
    # do best with punchy hook copy; portrait (4:5) is the most-read carousel
    # format; landscape (16:9) is typically a video/IGTV cross-post and gets
    # a different CTA framing. Omitted → no ratio guidance in the prompt.
    image_ratio: Literal["1:1", "4:5", "16:9"] | None = None
    # Optional GPT-4o Vision analysis of the image the caption accompanies.
    # When supplied, the caption can describe what's actually pictured —
    # this is the difference between "Check out our latest!" generic copy
    # and "This rose perfume's gold cap catches the morning light…".
    image_analysis: dict | None = None


def generate_caption_text(
    db: Session,
    *,
    account_ids: list,
    primary_account_id: str | None,
    content_type: str,
    topic: str | None,
    language: str,
    reference_caption: str | None,
    post_id: str | None,
    image_ratio: str | None,
    image_analysis: dict | None,
    source: str = "user",
) -> str:
    """Generate a caption — same logic as POST /generate-caption, callable from
    any context (FastAPI handler, Celery task, batch generator).

    Pulled out of the endpoint so the batch-generate Celery task can produce
    captions without going through HTTP. Raises AIProviderError on quota /
    invalid-response / upstream failures so the caller can decide whether to
    degrade gracefully or mark a per-day status as failed.
    """
    provider = get_provider("captions")
    if not _ai_available():
        return ""

    body_topic = (topic or "").strip()
    body_lang = language
    reference = reference_caption or ""
    if post_id and not reference and account_ids:
        post = (
            db.query(Post.caption, Post.content_type)
            .filter(Post.id == post_id, Post.social_account_id.in_(account_ids))
            .first()
        )
        if post:
            reference = post.caption or ""

    ia = image_analysis or {}
    ia_summary = (
        f"{(ia.get('product_description') or '').strip()}|"
        f"{(ia.get('brand_name') or '').strip()}|"
        f"{(ia.get('product_name') or '').strip()}|"
        f"{','.join((ia.get('key_features') or [])[:4])}|"
        f"{(ia.get('detected_style') or '').strip()}|"
        f"{(ia.get('suggested_tone') or '').strip()}"
    ) if ia else ""

    cache_payload = json.dumps(
        {
            "content_type": content_type,
            "topic": body_topic,
            "post_id": post_id or "",
            "reference": reference[:300],
            "image_ratio": image_ratio or "",
            "image_analysis": ia_summary,
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    cache_hash = hashlib.sha256(cache_payload.encode("utf-8")).hexdigest()[:40]
    cache_page_name = f"caption:{cache_hash}"

    cached = _cache_get(
        db, primary_account_id, cache_page_name, body_lang,
        ttl_hours=CACHE_CAPTION_TTL_HOURS,
    )
    if cached and cached.get("caption"):
        return cached["caption"]

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

    style_examples: list[str] = []
    if account_ids:
        style_rows = (
            db.query(Post.caption)
            .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
            .filter(
                Post.social_account_id.in_(account_ids),
                Post.caption.isnot(None),
            )
            .group_by(Post.id, Post.caption)
            .order_by(func.coalesce(func.sum(EngagementMetric.likes), 0).desc())
            .limit(5)
            .all()
        )
        style_examples = [
            (r.caption or "").strip()
            for r in style_rows
            if r.caption and r.caption.strip()
        ]

    top_hashtags = _extract_top_hashtags(account_captions, n=5)
    emoji_rate = _emoji_usage_rate(account_captions)
    allow_emojis = emoji_rate > 0.5

    lang_label = "Arabic" if body_lang == "ar" else "English"
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

    bp = _business_profile_for_account(db, primary_account_id)
    bp_line = format_business_profile(bp)
    brand_block = _brand_context_block(db, primary_account_id)
    ratio_label = {"1:1": "square", "4:5": "portrait", "16:9": "landscape"}.get(
        image_ratio or ""
    )
    ratio_rule = (
        f"This caption is for a {ratio_label} Instagram post. "
        if ratio_label
        else ""
    )

    image_block = ""
    brand_name = (ia or {}).get("brand_name") or ""
    product_name = (ia or {}).get("product_name") or ""
    key_features = (ia or {}).get("key_features") or []
    has_product_identity = bool(brand_name or product_name)
    if ia and ia.get("product_description"):
        suggestions = ia.get("content_suggestions") or []
        first_suggestion = suggestions[0] if suggestions else ""
        features_line = (
            f"- Key features: {', '.join(key_features[:4])}\n"
            if key_features else ""
        )
        image_block = (
            "IMAGE ANALYSIS:\n"
            f"- Product: {ia.get('product_description', '')}\n"
            + (f"- Brand: {brand_name}\n" if brand_name else "")
            + (f"- Product name: {product_name}\n" if product_name else "")
            + features_line
            + f"- Style: {(ia.get('detected_style') or '').title() or 'Unspecified'}\n"
            f"- Suggested tone: {(ia.get('suggested_tone') or '').title() or 'Unspecified'}\n"
            + (f"- Content angle: {first_suggestion}\n" if first_suggestion else "")
        )

    specificity_mandate = ""
    if has_product_identity:
        if brand_name and product_name:
            target = f"{product_name} by {brand_name}"
        elif product_name:
            target = product_name
        else:
            target = f"this {brand_name} product"
        feat_clause = (
            f" Mention at least one of these visible details: {', '.join(key_features[:3])}."
            if key_features else ""
        )
        specificity_mandate = (
            f"The caption MUST mention {target} by name and write specifically "
            f"about it.{feat_clause} Do NOT write generic copy that could apply "
            "to any product — this caption is about this exact product."
        )

    sys = (
        f"You are an Instagram copywriter. Write a single caption ENTIRELY in {lang_label}. "
        f"This is a hard requirement — even if the reference caption is in a different language, "
        f"the output MUST be in {lang_label}. "
        "Write something a small business owner can paste directly into Instagram. "
        "Match Instagram's voice — short, punchy, scannable. "
        "1-3 lines, end with a clear question or call-to-action. "
        "Write in a natural, human voice. Avoid marketing clichés like: "
        "transform, oasis, dive in, sparkling, crystal-clear, unleash, elevate, "
        "indulge, discover, experience (unless the style examples below use them). "
        "Do not use excessive exclamation marks — at most one. "
        "Sound like a real business owner talking to their customers, not a marketer. "
        "Match the tone of the style examples exactly. "
        + ratio_rule
        + (
            f"This caption is for: {bp_line}. Tailor language, references, and CTA to that "
            "industry, city, and audience language; avoid generic copy that could apply to "
            "any business. "
            if bp_line
            else ""
        )
        + (f"\n\n{brand_block}\n" if brand_block else "")
        + (f"\n{image_block}\n" if image_block else "")
        + (
            "Reference the actual product or scene visible in the image. "
            "Make the copy feel anchored to what is pictured — do not write generic copy. "
            if image_block and not specificity_mandate
            else ""
        )
        + (f"\n{specificity_mandate}\n" if specificity_mandate else "")
        + f"{hashtag_rule} "
        f"{emoji_rule} "
        "No quotation marks around the caption. No preamble like 'Here is...'. "
        "Return ONLY the caption text."
    )

    parts = [
        f"Content type: {content_type}",
        f"Target language: {lang_label}",
    ]
    if bp_line:
        parts.append(f"Business context: {bp_line}")
    if body_topic:
        parts.append(f"Topic: {body_topic}")
    if top_hashtags:
        parts.append("Preferred hashtags (from this account's own posts): " + " ".join(top_hashtags))
    if style_examples:
        examples_block = "\n".join(
            f"{i + 1}. {ex[:280]}"
            for i, ex in enumerate(style_examples)
        )
        parts.append(
            "STYLE EXAMPLES FROM THIS ACCOUNT (write in a similar human voice, "
            "do NOT copy them verbatim):\n" + examples_block
        )
    if reference:
        parts.append(
            f"Reference (for tone only — rewrite in {lang_label}, do not copy):\n{reference[:300]}"
        )
    user_msg = "\n".join(parts)

    text = provider.generate_text(
        sys, user_msg, temperature=0.85,
        account_id=primary_account_id, task="captions", source=source,
        language=body_lang,
    )

    if text and not allow_emojis:
        text = _strip_emoji(text)
    if text:
        _cache_put(db, primary_account_id, cache_page_name, body_lang, {"caption": text})
    return text or ""


@router.post("/generate-caption")
def generate_caption(
    body: CaptionRequest = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a single ready-to-copy caption via OpenAI (preferred) or Gemini
    in EN or AR. AI failures return a degraded response with stale cache when
    available, else a 503."""
    if not _ai_available():
        return {
            "success": True,
            "data": {"caption": ""},
            "meta": build_fresh_meta(),
        }

    account_ids = _org_account_ids(db, user)
    primary_account_id = str(account_ids[0]) if account_ids else None

    try:
        text = generate_caption_text(
            db,
            account_ids=account_ids,
            primary_account_id=primary_account_id,
            content_type=body.content_type,
            topic=body.topic,
            language=body.language,
            reference_caption=body.reference_caption,
            post_id=body.post_id,
            image_ratio=body.image_ratio,
            image_analysis=body.image_analysis,
            source="user",
        )
    except AIProviderError as exc:
        # Captions have no useful data-only fallback — entire response is AI.
        return degraded_no_cache_response(exc)

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

    primary_account_id = str(account_ids[0])
    bp = _business_profile_for_account(db, primary_account_id)
    sys = (
        "You are an audience-strategy advisor for an Instagram creator. "
        "Given last week's audience signals, return strict JSON describing: "
        "(1) a 2-sentence behavior summary, "
        "(2) THREE specific content topics this audience wants to see next, "
        "(3) WHY the top posting slot works for this audience. "
        "Be specific. Reference percentages, comment themes, content types. "
        "No emojis, no markdown, no preamble."
        + _BUSINESS_TAILORING_RULE
        + " "
        + _language_rule(language)
    )
    user_msg = (
        _business_context_block(bp)
        + _brand_context_block(db, primary_account_id)
        + f"Total comments last 7 days: {total_week_comments}\n"
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
        result = _gemini_json(sys, user_msg, account_id=primary_account_id, language=language) or {}
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
        cached = {}
        meta = {
            "status": "degraded",
            "cached": False,
            "message": exc.user_message,
            "retry_after_hours": exc.retry_after_hours,
        }

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

    primary_account_id = str(account_ids[0])
    org_id = _organization_id_for_account(db, primary_account_id)
    org = (
        db.query(Organization).filter(Organization.id == org_id).first()
        if org_id
        else None
    )
    bp = org.business_profile if org else None
    bi = org.brand_identity if org else None

    business_block = _business_context_block(bp)
    brand_block = format_brand_identity(org_id, db)
    inferred_block = ""
    if not business_block and not brand_block:
        inferred_block = _infer_context_from_captions(
            [(r.caption or "") for r in top_caps_rows]
        )
        if inferred_block:
            logger.info(
                "content_plan_inferred_context_used org_id=%s account_id=%s",
                org_id, primary_account_id,
            )

    sys = (
        "You are a content-planning advisor for an Instagram creator. "
        "Given the creator's top-performing captions and a 7-day plan skeleton "
        "(date + content type per day), return strict JSON adding ONE specific "
        "topic per day that is fresh, on-brand, and varied across the week. "
        "Topics must be 4-10 words, written as headlines (no markdown, no quotes). "
        "Do NOT repeat the same topic across days."
        + _BUSINESS_TAILORING_RULE
        + _FORBIDDEN_WEEKDAY_RULE
        + " "
        + _language_rule(language)
    )
    skeleton_lines = [
        f"Day {d['day_index']} ({d['date']}, type={d['content_type']})"
        for d in days
    ]
    user_msg = (
        business_block
        + brand_block
        + inferred_block
        + "Top-performing captions from this account (for inspiration only):\n"
        + ("\n".join(top_caps_lines) or "(none yet)")
        + "\n\nWeek plan skeleton:\n"
        + "\n".join(skeleton_lines)
        + "\n\nReturn JSON:\n"
        '{ "topics": [\n'
        '  { "day_index": 0, "topic": "..." },\n'
        "  ...7 entries\n"
        "]}"
    )

    def _extract(result: dict) -> dict[str, str]:
        return {
            str(int(t["day_index"])): (t.get("topic") or "").strip()
            for t in (result.get("topics") or [])
            if isinstance(t, dict) and "day_index" in t
        }

    pillars_for_fallback = []
    if isinstance(bi, dict):
        pillars_for_fallback = bi.get("content_pillars") or []

    def _compute() -> dict:
        result = _gemini_json(
            sys, user_msg, temperature=0.7,
            account_id=primary_account_id, language=language,
        ) or {}
        topics_by_idx = _extract(result)

        offending = {
            idx: t for idx, t in topics_by_idx.items()
            if _topic_has_forbidden_pattern(t)
        }
        if offending:
            logger.warning(
                "content_plan_forbidden_pattern_retries org_id=%s account_id=%s hits=%s",
                org_id, primary_account_id, offending,
            )
            retry_sys = sys + _RETRY_DIRECTIVE
            retry_result = _gemini_json(
                retry_sys, user_msg, temperature=0.7,
                account_id=primary_account_id, language=language,
            ) or {}
            topics_by_idx = _extract(retry_result)

            still_offending = {
                idx: t for idx, t in topics_by_idx.items()
                if _topic_has_forbidden_pattern(t)
            }
            for idx, original in still_offending.items():
                sub = _pillar_fallback(int(idx), pillars_for_fallback)
                logger.warning(
                    "content_plan_forbidden_pattern_fallbacks org_id=%s account_id=%s "
                    "day_index=%s original=%r substitute=%r",
                    org_id, primary_account_id, idx, original, sub,
                )
                topics_by_idx[idx] = sub
        else:
            logger.info(
                "content_plan_topics_clean org_id=%s account_id=%s n=%s",
                org_id, primary_account_id, len(topics_by_idx),
            )

        return {"topics_by_idx": topics_by_idx}

    try:
        cached, meta = _resolve_ai_payload(
            db, primary_account_id, "content-plan", language, _compute,
        )
    except AIProviderError as exc:
        cached = {"topics_by_idx": {}}
        meta = {
            "status": "degraded",
            "cached": False,
            "message": exc.user_message,
            "retry_after_hours": exc.retry_after_hours,
        }

    topics_by_idx = cached.get("topics_by_idx", {}) or {}
    for d in days:
        key = str(d["day_index"])
        if key in topics_by_idx:
            d["topic"] = topics_by_idx[key]

    # Annotate each day with the scheduled_post that originated from it
    # (if any), so the frontend can swap "Create post for this day" for
    # "View scheduled post" + render a "Scheduled ✓" badge. content_plan_day
    # on scheduled_post is a DATE column populated by the wizard at submit
    # time — single IN-query, no date-range scan.
    plan_dates = [_date.fromisoformat(d["date"]) for d in days]
    sched_rows = (
        db.query(
            ScheduledPost.id,
            ScheduledPost.status,
            ScheduledPost.permalink,
            ScheduledPost.content_plan_day,
            ScheduledPost.created_at,
        )
        .filter(
            ScheduledPost.organization_id == user.organization_id,
            ScheduledPost.social_account_id.in_(account_ids),
            ScheduledPost.content_plan_day.in_(plan_dates),
            ScheduledPost.status != "cancelled",
        )
        .all()
    )
    # When multiple posts share a content_plan_day, prefer the most-progressed
    # status (published > publishing > scheduled > draft > failed), then the
    # most recently created one — that's the post the user most likely wants
    # surfaced behind the badge.
    _STATUS_PRIORITY = {
        "published": 0,
        "publishing": 1,
        "scheduled": 2,
        "draft": 3,
        "failed": 4,
    }
    by_day: dict[str, dict] = {}
    sorted_rows = sorted(
        sched_rows,
        key=lambda r: (
            _STATUS_PRIORITY.get(r.status, 99),
            -(r.created_at.timestamp() if r.created_at else 0),
        ),
    )
    for r in sorted_rows:
        key = r.content_plan_day.isoformat()
        if key in by_day:
            continue
        by_day[key] = {
            "id": str(r.id),
            "status": r.status,
            "permalink": r.permalink,
        }
    for d in days:
        d["scheduled_post"] = by_day.get(d["date"])

    return {"success": True, "data": {"days": days}, "meta": meta}


# ── Content Plan: user-override of a single day's topic ────────────────

class UpdateContentPlanTopicRequest(BaseModel):
    social_account_id: str
    language: LanguageParam = "en"
    day_index: int = Field(..., ge=0, le=6)
    new_topic: str = Field(..., min_length=1, max_length=200)


@router.patch("/content-plan/topic")
def update_content_plan_topic(
    body: UpdateContentPlanTopicRequest = Body(...),
    user: User = Depends(require_admin_or_manager),
    _gated: User = Depends(RequireFeature("content_recommendations")),
    db: Session = Depends(get_db),
):
    """Persist a user-edited Content Plan topic for a single day.

    Powers the "Update the suggestion (until next refresh)" branch of the
    Create-Post wizard's cancel dialog. Writes the new topic into the
    existing ai_page_cache row keyed by (social_account_id, "content-plan",
    language) and stamps `last_user_edit_at` — `generated_at` is left alone
    so the SWR layer still treats the row as having its original AI-fresh
    timestamp. The user override therefore survives until the next AI
    regeneration overwrites the row, which matches the wizard copy.
    """
    # Validate social_account_id belongs to caller's organization.
    account = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.id == body.social_account_id,
            SocialAccount.organization_id == user.organization_id,
        )
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Social account not found")

    row = (
        db.query(AiPageCache)
        .filter(
            AiPageCache.social_account_id == body.social_account_id,
            AiPageCache.page_name == "content-plan",
            AiPageCache.language == body.language,
        )
        .first()
    )
    if not row:
        # GET /content-plan must materialize the row first — without it
        # there's nothing to patch. Force the frontend to load the plan
        # before editing rather than silently creating a partial row.
        raise HTTPException(
            status_code=422,
            detail="No content plan cached for this account+language yet. Load /content-plan first.",
        )

    content = dict(row.content or {})
    topics = dict(content.get("topics_by_idx") or {})
    topics[str(body.day_index)] = body.new_topic.strip()
    content["topics_by_idx"] = topics
    row.content = content
    row.last_user_edit_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "success": True,
        "data": {
            "social_account_id": body.social_account_id,
            "language": body.language,
            "day_index": body.day_index,
            "topic": topics[str(body.day_index)],
            "last_user_edit_at": row.last_user_edit_at.isoformat(),
        },
    }


# ── Content Plan: bust the cache so the next GET regenerates ────────────


class RegenerateContentPlanRequest(BaseModel):
    """Optional payload. Defaulting both fields makes the endpoint callable as
    a bare POST when the frontend just wants "regenerate for whatever's
    primary right now."""

    social_account_id: Optional[str] = None
    language: LanguageParam = "en"


@router.post("/content-plan/regenerate")
def regenerate_content_plan(
    body: RegenerateContentPlanRequest = Body(default_factory=RegenerateContentPlanRequest),
    user: User = Depends(require_admin_or_manager),
    _gated: User = Depends(RequireFeature("content_recommendations")),
    db: Session = Depends(get_db),
):
    """Delete the cached content plan row so the next GET /content-plan rebuilds
    it from Gemini. The actual regeneration happens lazily on the follow-up
    GET — the frontend invalidates its React Query cache on success and the
    re-fetch sees an empty `ai_page_cache` row → inline recompute.
    """
    account_ids = _org_account_ids(db, user)
    if not account_ids:
        raise HTTPException(status_code=422, detail="No active social accounts.")

    target = body.social_account_id or str(account_ids[0])
    # Multi-tenant guard: only delete cache rows for accounts in the caller's org.
    if target not in [str(a) for a in account_ids]:
        raise HTTPException(status_code=404, detail="Social account not found")

    deleted = (
        db.query(AiPageCache)
        .filter(
            AiPageCache.social_account_id == target,
            AiPageCache.page_name == "content-plan",
            AiPageCache.language == body.language,
        )
        .delete()
    )
    db.commit()

    return {
        "success": True,
        "data": {
            "social_account_id": target,
            "language": body.language,
            "deleted": int(deleted),
        },
    }


# ── Content Plan: "Generate all 7 posts" batch flow ─────────────────────


BatchAction = Literal["drafts", "schedule"]


class BatchGenerateRequest(BaseModel):
    """Body for POST /content-plan/batch-generate.

    `remember` controls whether `action` is persisted to the user's profile so
    subsequent clicks can skip the confirmation dialog. False (or omitted) means
    "this run only" — the user's preference is unchanged."""

    social_account_id: Optional[str] = None
    language: LanguageParam = "en"
    action: BatchAction
    remember: bool = False


def _batch_progress_to_dict(row) -> dict:
    """Serialize a BatchGenerateProgress row to the frontend response shape."""
    return {
        "id": str(row.id),
        "social_account_id": str(row.social_account_id),
        "language": row.language,
        "action": row.action,
        "status": row.status,
        "per_day_status": row.per_day_status or {},
        "started_at": row.started_at.isoformat() if row.started_at else None,
        "completed_at": row.completed_at.isoformat() if row.completed_at else None,
        "error_message": row.error_message,
    }


@router.post("/content-plan/batch-generate")
def batch_generate_content_plan_endpoint(
    body: BatchGenerateRequest = Body(...),
    user: User = Depends(require_admin_or_manager),
    _gated: User = Depends(RequireFeature("content_recommendations")),
    db: Session = Depends(get_db),
):
    """Start a "Generate all 7 posts" batch run.

    Creates a BatchGenerateProgress row up-front (so the frontend has a stable
    batch_id to poll regardless of how Celery handles enqueue), persists the
    user's remember-my-choice preference when requested, then fires the Celery
    task. Returns 409 if a batch is already in flight for the same
    (account, language) — duplicate clicks are silently rejected rather than
    racing two batches into the same 7 days.
    """
    # Late import keeps the FastAPI router file independent of the task
    # module's transitive deps (Celery is loaded by the app, but the task
    # module also imports ai_image which has its own slow init paths).
    from app.models.batch_generate_progress import BatchGenerateProgress
    from app.tasks.content_plan_batch import (
        batch_generate_content_plan,
        _day_status_template,
    )

    account_ids = _org_account_ids(db, user)
    if not account_ids:
        raise HTTPException(status_code=422, detail="No active social accounts.")

    target = body.social_account_id or str(account_ids[0])
    if target not in [str(a) for a in account_ids]:
        raise HTTPException(status_code=404, detail="Social account not found")

    # Validate the plan exists in cache before we kick off a Celery task that
    # would otherwise discover the missing cache and mark the whole batch as
    # failed — early-422 surfaces the issue to the user in the same HTTP
    # round-trip rather than via the progress endpoint.
    cache_row = (
        db.query(AiPageCache)
        .filter(
            AiPageCache.social_account_id == target,
            AiPageCache.page_name == "content-plan",
            AiPageCache.language == body.language,
        )
        .first()
    )
    if not cache_row or not cache_row.content:
        raise HTTPException(
            status_code=422,
            detail="No content plan cached for this account+language yet. Load /content-plan first.",
        )
    topics = (cache_row.content or {}).get("topics_by_idx") or {}
    if sum(1 for k in topics if topics[k]) < 7:
        raise HTTPException(
            status_code=422,
            detail="Content plan is incomplete — fewer than 7 days have topics. Regenerate the plan and try again.",
        )

    # Guard against duplicate in-flight batches for the same (account, lang).
    # Two simultaneous "Generate all 7" clicks would race two Celery tasks
    # creating 14 scheduled_post rows instead of 7.
    existing = (
        db.query(BatchGenerateProgress)
        .filter(
            BatchGenerateProgress.social_account_id == target,
            BatchGenerateProgress.language == body.language,
            BatchGenerateProgress.status == "running",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "A batch is already running for this account and language.",
                "batch_id": str(existing.id),
            },
        )

    # Persist the user's preference if requested. Unchecking "remember" on a
    # subsequent click also runs through this branch — we update both fields
    # so unchecking effectively clears the saved default.
    user.batch_generate_default_action = body.action if body.remember else None
    user.batch_generate_remember = body.remember

    progress = BatchGenerateProgress(
        organization_id=user.organization_id,
        social_account_id=target,
        user_id=user.id,
        language=body.language,
        action=body.action,
        status="running",
        per_day_status=_day_status_template(),
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)

    try:
        batch_generate_content_plan.delay(str(progress.id))
    except Exception:  # noqa: BLE001
        logger.exception("batch-generate: delay failed batch=%s", progress.id)
        progress.status = "failed"
        progress.error_message = "Could not enqueue background task. Try again."
        progress.completed_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="Could not enqueue background task. Try again.",
        )

    return {
        "success": True,
        "data": _batch_progress_to_dict(progress),
    }


@router.get("/content-plan/batch-progress")
def get_batch_progress(
    batch_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current state of a batch run. Polled by the progress modal
    every ~4s while open."""
    from app.models.batch_generate_progress import BatchGenerateProgress

    row = (
        db.query(BatchGenerateProgress)
        .filter(BatchGenerateProgress.id == batch_id)
        .first()
    )
    if not row or row.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Batch not found")

    return {
        "success": True,
        "data": _batch_progress_to_dict(row),
    }


@router.get("/content-plan/batch-progress/latest")
def get_latest_batch_progress(
    language: LanguageParam = Query("en"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the most recent batch (running or otherwise) for the caller's
    primary account+language, or `null` when there's never been one. Powers
    the cross-navigation modal: when the user returns to the Content Plan
    page mid-batch, the frontend can pick up the polling exactly where it
    left off.
    """
    from app.models.batch_generate_progress import BatchGenerateProgress

    account_ids = _org_account_ids(db, user)
    if not account_ids:
        return {"success": True, "data": None}
    primary = str(account_ids[0])

    row = (
        db.query(BatchGenerateProgress)
        .filter(
            BatchGenerateProgress.social_account_id == primary,
            BatchGenerateProgress.language == language,
        )
        .order_by(BatchGenerateProgress.started_at.desc())
        .first()
    )
    if not row:
        return {"success": True, "data": None}

    return {
        "success": True,
        "data": _batch_progress_to_dict(row),
    }


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

    primary_account_id = str(account_ids[0])
    bp = _business_profile_for_account(db, primary_account_id)
    sys = (
        "You are a customer-care specialist replying publicly on Instagram. "
        "For each post, write ONE empathetic, professional reply (1-2 sentences) "
        "the business owner can paste verbatim under the post. "
        "Acknowledge the concern, take responsibility where appropriate, and "
        "offer a concrete next step (e.g. 'DM us your order number'). "
        "Never sound defensive or corporate. No emojis, no hashtags, no markdown."
        + _BUSINESS_TAILORING_RULE
        + " "
        + _language_rule(language)
    )
    user_msg = (
        _business_context_block(bp)
        + _brand_context_block(db, primary_account_id)
        + "For each post below, return ONE response template. Return strict JSON:\n"
        '{ "templates": [ { "post_id": "...", "response_template": "..." } ] }\n\n'
        + "\n\n".join(
            f"POST {i + 1} (id={r['post_id']}, {r['neg_count']} negative comments)\n"
            f"Caption: {r['caption']}\n"
            f"Sample negative comments:\n" + "\n".join(f"  - {s}" for s in r["samples"])
            for i, r in enumerate(payload_rows)
        )
    )

    def _compute() -> dict:
        result = _gemini_json(
            sys, user_msg, temperature=0.6,
            account_id=primary_account_id, language=language,
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
        cached = {"templates_by_id": {}}
        meta = {
            "status": "degraded",
            "cached": False,
            "message": exc.user_message,
            "retry_after_hours": exc.retry_after_hours,
        }

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
    business_profile = _business_profile_for_account(db, account_id)

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
        "business_profile": business_profile,
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
            "business_profile",
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
    brand_block = _brand_context_block(db, primary_account_id)
    system = (
        "You are Basiret, an AI analytics assistant for Instagram. You answer "
        "questions about the user's own Instagram account using only the data "
        "provided below.\n\n"
        "Rules:\n"
        "- Never invent numbers. If the data doesn't contain the answer, say so directly.\n"
        "- Be specific — use actual numbers from the data, not vague statements.\n"
        "- Keep answers concise — 2-5 sentences for simple questions, up to 8 for complex ones.\n"
        "- If the user asks for a recommendation, base it on patterns in the data.\n"
        "- If `business_profile` is present, tailor recommendations to that industry, city, "
        "and audience language — a restaurant in Dubai expects different advice than a "
        "fashion brand in Cairo. Generic advice that ignores the business context is a failure.\n"
        "- If a BRAND IDENTITY block is provided, match the user's tone, language style, "
        "emoji usage, caption length, and content pillars in any draft copy or recommendation.\n"
        "- Tone: expert but approachable. Not corporate. Not overly casual.\n"
        f"- Language: respond in {lang_label}. "
        + ("If Arabic, use Modern Standard Arabic." if body.language == "ar" else "")
        + (f"\n\n{brand_block}" if brand_block else "")
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
