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
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import RequireFeature, get_current_user
from app.models.analysis_result import AnalysisResult
from app.models.audience_segment import AudienceSegment
from app.models.comment import Comment
from app.models.engagement_metric import EngagementMetric
from app.models.post import Post
from app.models.social_account import SocialAccount
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


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


# ── My Posts: best post + low-performer pattern ───────────────────────────


@router.get("/posts-insights")
def posts_insights(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the top post enriched with a Gemini "why it worked" + a Gemini
    "what to change" pattern across the bottom-third performers.

    Free for all plan tiers — this is the My Posts page's headline action card.
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
        )
        .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id.in_(account_ids))
        .group_by(Post.id)
        .all()
    )
    if not rows:
        return {"success": True, "data": empty}

    ranked = sorted(rows, key=lambda r: (r.likes or 0) + (r.comments or 0), reverse=True)
    best = ranked[0]
    bottom_n = max(1, len(ranked) // 3)
    bottom = ranked[-bottom_n:]

    best_payload = {
        "id": str(best.id),
        "caption": (best.caption or "")[:400],
        "content_type": best.content_type.value if best.content_type else "unknown",
        "likes": int(best.likes or 0),
        "comments": int(best.comments or 0),
        "posted_at": best.posted_at.isoformat() if best.posted_at else None,
        "permalink": (best.raw_data or {}).get("permalink") if best.raw_data else None,
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

    user_msg = (
        "Analyze the following Instagram performance data and return strict JSON.\n\n"
        "TOP POST:\n"
        f"- type: {best_payload['content_type']}\n"
        f"- likes: {best_payload['likes']}, comments: {best_payload['comments']}\n"
        f"- caption: '''{best_payload['caption']}'''\n\n"
        "LOW PERFORMERS (bottom third by engagement):\n"
        + "\n".join(bottom_lines)
        + "\n\n"
        "Return JSON with these EXACT keys:\n"
        '  "why_it_worked": 2 sentences explaining why the top post outperformed.\n'
        '  "low_performers_pattern": 2 sentences naming a SHARED pattern across the low performers.\n'
        '  "what_to_change": 1-2 sentences with a SPECIFIC, ACTIONABLE change to fix the pattern.\n'
        "Be concrete. Reference numbers, content type, or caption style. No markdown, no preamble."
    )
    sys = (
        "You are a content-performance analyst for an Instagram creator. "
        "Compare a top-performing post against low-performing posts and return strict JSON. "
        "Be specific and actionable, never generic. No emojis, no markdown."
    )
    result = _gemini_json(sys, user_msg)
    if result:
        payload["why_it_worked"] = (result.get("why_it_worked") or "").strip()
        payload["low_performers_pattern"] = (result.get("low_performers_pattern") or "").strip()
        payload["what_to_change"] = (result.get("what_to_change") or "").strip()

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
    """Generate a single ready-to-copy caption via Gemini in EN or AR."""
    if not _gemini_available():
        return {"success": True, "data": {"caption": ""}}

    # If post_id passed, hydrate the reference_caption from the DB so the caller
    # doesn't need to know the original text.
    reference = body.reference_caption or ""
    if body.post_id and not reference:
        account_ids = _org_account_ids(db, user)
        post = (
            db.query(Post.caption, Post.content_type)
            .filter(Post.id == body.post_id, Post.social_account_id.in_(account_ids))
            .first()
        )
        if post:
            reference = post.caption or ""

    lang_label = "Arabic" if body.language == "ar" else "English"
    sys = (
        f"You are an Instagram copywriter. Write a single caption in {lang_label} "
        "that a small business owner can paste directly into Instagram. "
        "Match Instagram's voice — short, punchy, scannable. "
        "1-3 lines, end with a clear question or call-to-action. "
        "Add 2-4 relevant hashtags on the last line. "
        "No quotation marks around the caption. No preamble like 'Here is...'. "
        "Return ONLY the caption text."
    )

    parts = [
        f"Content type: {body.content_type}",
    ]
    if body.topic:
        parts.append(f"Topic: {body.topic}")
    if reference:
        parts.append(f"Reference (write a similar caption, do not copy):\n{reference[:300]}")
    user_msg = "\n".join(parts)

    text = _gemini_text(sys, user_msg, temperature=0.85)
    return {"success": True, "data": {"caption": text}}


# ── My Audience: behavior summary + what they want + best time ────────────


@router.get("/audience-insights")
def audience_insights(
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
        "No emojis, no markdown, no preamble."
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
    result = _gemini_json(sys, user_msg)
    if result:
        payload["behavior_summary"] = (result.get("behavior_summary") or "").strip()
        what = result.get("what_they_want") or []
        payload["what_they_want"] = [
            {
                "topic": (item.get("topic") or "").strip(),
                "reason": (item.get("reason") or "").strip(),
            }
            for item in what
            if isinstance(item, dict) and item.get("topic")
        ][:3]
        payload["best_time"]["reason"] = (result.get("best_time_reason") or "").strip()

    return {"success": True, "data": payload}


# ── Content Plan: 7-day calendar with AI topic per day ────────────────────


@router.get("/content-plan")
def content_plan(
    user: User = Depends(RequireFeature("content_recommendations")),
    db: Session = Depends(get_db),
):
    """Return a 7-day content calendar starting today.

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
            "Do NOT repeat the same topic across days. Use English."
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
        result = _gemini_json(sys, user_msg, temperature=0.7)
        if result:
            topics_by_idx = {
                int(t["day_index"]): (t.get("topic") or "").strip()
                for t in (result.get("topics") or [])
                if isinstance(t, dict) and "day_index" in t
            }
            for d in days:
                if d["day_index"] in topics_by_idx:
                    d["topic"] = topics_by_idx[d["day_index"]]

    return {"success": True, "data": {"days": days}}


# ── Sentiment: suggested response templates for needs-attention posts ────


@router.get("/sentiment-responses")
def sentiment_responses(
    user: User = Depends(RequireFeature("sentiment_analysis")),
    db: Session = Depends(get_db),
):
    """For each post with >2 negative comments, return a suggested empathetic
    public reply template the creator can paste into Instagram. Top 3 only.

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
        "Match the language of the negative comments — Arabic if the comments are "
        "in Arabic, English otherwise. "
        "Never sound defensive or corporate. No emojis, no hashtags, no markdown."
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
    result = _gemini_json(sys, user_msg, temperature=0.6)
    templates_by_id: dict[str, str] = {}
    if result:
        for t in result.get("templates") or []:
            if isinstance(t, dict) and t.get("post_id"):
                templates_by_id[str(t["post_id"])] = (t.get("response_template") or "").strip()

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
