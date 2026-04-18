"""
Weekly PDF report generation (Pro).

GET /reports/weekly?account_id=<uuid> — returns a branded PDF report.
"""
import io
import logging
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

import arabic_reshaper
from bidi.algorithm import get_display

from app.core.database import get_db
from app.core.deps import RequireFeature
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.models.analysis_result import AnalysisResult
from app.models.engagement_metric import EngagementMetric
from app.models.social_account import SocialAccount
from app.models.audience_segment import AudienceSegment
from app.models.insight_result import InsightResult

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Brand palette ───────────────────────────────────────────
PURPLE = HexColor("#664FA1")
TEXT = HexColor("#484848")
MUTED = HexColor("#9B9B9B")
DIVIDER = HexColor("#E7E5EE")
POSITIVE = HexColor("#10B981")
NEUTRAL = HexColor("#9CA3AF")
NEGATIVE = HexColor("#EF4444")
PRIORITY_HIGH = HexColor("#BF499B")
PRIORITY_MEDIUM = HexColor("#664FA1")
PRIORITY_LOW = HexColor("#A5DDEC")

PAGE_W, PAGE_H = A4
MARGIN_X = 20 * mm

# ── Font registration (Amiri for Arabic, Helvetica built-in for Latin) ────
# Amiri is SIL OFL licensed and bundled at app/fonts/. Without it, ReportLab's
# Helvetica cannot render U+0600–U+06FF and Arabic comments/captions become
# black boxes. Reshaping + bidi are also required — isolated letters render
# disconnected and in logical (backward) order otherwise.
FONTS_DIR = Path(__file__).resolve().parent.parent.parent / "fonts"
FONT_AR = "Amiri"
FONT_AR_BOLD = "Amiri-Bold"
FONT_LATIN = "Helvetica"
FONT_LATIN_BOLD = "Helvetica-Bold"
FONT_LATIN_ITALIC = "Helvetica-Oblique"

try:
    pdfmetrics.registerFont(TTFont(FONT_AR, str(FONTS_DIR / "Amiri-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_AR_BOLD, str(FONTS_DIR / "Amiri-Bold.ttf")))
except Exception as exc:  # pragma: no cover — log and fall back to Latin-only
    logger.warning("Failed to register Amiri Arabic font: %s", exc)

_ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]")

# Emoji + pictograph ranges. Neither Amiri nor Helvetica covers these, so
# leaving them in produces black boxes in the PDF. Strip at display time.
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F680-\U0001F6FF"  # transport & map
    "\U0001F700-\U0001F77F"
    "\U0001F780-\U0001F7FF"
    "\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF"  # supplemental symbols
    "\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF"
    "\U00002600-\U000026FF"  # misc symbols (sun, snowflake…)
    "\U00002700-\U000027BF"  # dingbats
    "\U0001F1E6-\U0001F1FF"  # regional indicator flags
    "\U0000FE00-\U0000FE0F"  # variation selectors
    "\U0000200D"             # zero-width joiner
    "]+",
    flags=re.UNICODE,
)


def _strip_emoji(text: str | None) -> str:
    """Remove emoji/pictograph codepoints that the bundled fonts can't render."""
    if not text:
        return ""
    cleaned = _EMOJI_RE.sub("", text)
    # Collapse the double-spaces left behind by stripped emoji.
    return re.sub(r" {2,}", " ", cleaned).strip()


def _contains_arabic(text: str | None) -> bool:
    if not text:
        return False
    return bool(_ARABIC_RE.search(text))


def _shape_ar(text: str) -> str:
    """Reshape + bidi-reorder so Arabic letters connect and render right-to-left."""
    try:
        return get_display(arabic_reshaper.reshape(text))
    except Exception as exc:  # pragma: no cover
        logger.warning("Arabic reshape failed: %s", exc)
        return text


def _pick_font(text: str | None, *, bold: bool = False, italic: bool = False) -> str:
    """Choose Amiri for Arabic text, Helvetica otherwise."""
    if _contains_arabic(text):
        return FONT_AR_BOLD if bold else FONT_AR
    if italic:
        return FONT_LATIN_ITALIC
    return FONT_LATIN_BOLD if bold else FONT_LATIN


def _prep(text: str | None) -> str:
    """Pipeline for any user-supplied string before it hits drawString.

    - Empty / None → ""
    - Emoji / pictographs → stripped (fonts can't render them)
    - Arabic → reshape + bidi (letters connect; visual order)
    - Latin → pass through unchanged (Amiri isn't needed)
    """
    cleaned = _strip_emoji(text)
    if not cleaned:
        return ""
    if _contains_arabic(cleaned):
        return _shape_ar(cleaned)
    return cleaned


def _draw_text(
    c: canvas.Canvas,
    x: float,
    y: float,
    text: str | None,
    *,
    font: str,
    size: int,
    right_edge: float | None = None,
) -> None:
    """Draw text, right-aligning to `right_edge` when the content is Arabic (RTL)."""
    prepared = _prep(text)
    if not prepared:
        return
    c.setFont(font, size)
    if _contains_arabic(text) and right_edge is not None:
        w = c.stringWidth(prepared, font, size)
        c.drawString(right_edge - w, y, prepared)
    else:
        c.drawString(x, y, prepared)


def _truncate(text: str | None, n: int) -> str:
    if not text:
        return ""
    t = text.strip().replace("\n", " ").replace("\r", " ")
    return t if len(t) <= n else t[: n - 1] + "…"


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round(100 * (current - previous) / previous, 1)


def _format_delta(delta: float | None) -> str:
    if delta is None:
        return "—"
    sign = "+" if delta >= 0 else ""
    return f"{sign}{delta}%"


# ── Data gathering ──────────────────────────────────────────

def _gather_report_data(db: Session, account: SocialAccount) -> dict:
    """Build the full dataset for one account's weekly report."""
    now = datetime.now(timezone.utc)
    wk1_start = now - timedelta(days=7)
    wk2_start = now - timedelta(days=14)

    # ── Posts in current + previous week
    def _posts_in(start: datetime, end: datetime):
        return (
            db.query(Post)
            .filter(Post.social_account_id == account.id)
            .filter(Post.posted_at >= start)
            .filter(Post.posted_at < end)
            .all()
        )

    current_posts = _posts_in(wk1_start, now)
    previous_posts = _posts_in(wk2_start, wk1_start)

    # ── Aggregated engagement per week (sum of latest engagement_metric per post)
    def _engagement_totals(post_ids: list[UUID]) -> dict:
        if not post_ids:
            return {"likes": 0, "comments": 0, "reach": 0, "count": 0}
        row = (
            db.query(
                func.coalesce(func.sum(EngagementMetric.likes), 0),
                func.coalesce(func.sum(EngagementMetric.comments), 0),
                func.coalesce(func.sum(EngagementMetric.reach), 0),
            )
            .filter(EngagementMetric.post_id.in_(post_ids))
            .first()
        )
        likes, comments, reach = row
        return {
            "likes": int(likes or 0),
            "comments": int(comments or 0),
            "reach": int(reach or 0),
            "count": len(post_ids),
        }

    current_eng = _engagement_totals([p.id for p in current_posts])
    previous_eng = _engagement_totals([p.id for p in previous_posts])

    # Reach proxy — if reach column is 0 (free-tier IG), fall back to likes+comments
    current_reach = current_eng["reach"] or (current_eng["likes"] + current_eng["comments"])
    previous_reach = previous_eng["reach"] or (previous_eng["likes"] + previous_eng["comments"])

    def _avg_eng(eng: dict) -> float:
        if eng["count"] == 0:
            return 0.0
        return round((eng["likes"] + eng["comments"]) / eng["count"], 1)

    current_avg_eng = _avg_eng(current_eng)
    previous_avg_eng = _avg_eng(previous_eng)

    # ── Sentiment score: % positive across all analyzed comments for this account
    all_post_ids_subq = (
        db.query(Post.id).filter(Post.social_account_id == account.id).subquery()
    )
    sentiment_rows = (
        db.query(AnalysisResult.sentiment, func.count(AnalysisResult.id))
        .join(Comment, AnalysisResult.comment_id == Comment.id)
        .filter(Comment.post_id.in_(db.query(all_post_ids_subq.c.id)))
        .group_by(AnalysisResult.sentiment)
        .all()
    )
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    for label, n in sentiment_rows:
        if label in sentiment_counts:
            sentiment_counts[label] = int(n)
    total_sent = sum(sentiment_counts.values())
    sentiment_score_now = round(100 * sentiment_counts["positive"] / total_sent) if total_sent else 0

    # Previous-week sentiment for WoW
    def _sentiment_count(start: datetime, end: datetime) -> tuple[int, int]:
        rows = (
            db.query(AnalysisResult.sentiment, func.count(AnalysisResult.id))
            .join(Comment, AnalysisResult.comment_id == Comment.id)
            .filter(Comment.post_id.in_(db.query(all_post_ids_subq.c.id)))
            .filter(Comment.created_at >= start)
            .filter(Comment.created_at < end)
            .group_by(AnalysisResult.sentiment)
            .all()
        )
        total = 0
        pos = 0
        for label, n in rows:
            n = int(n)
            total += n
            if label == "positive":
                pos = n
        return pos, total

    pos_now, tot_now = _sentiment_count(wk1_start, now)
    pos_prev, tot_prev = _sentiment_count(wk2_start, wk1_start)
    sent_score_current = round(100 * pos_now / tot_now) if tot_now else sentiment_score_now
    sent_score_previous = round(100 * pos_prev / tot_prev) if tot_prev else 0

    # ── Segments
    active_segments = (
        db.query(func.count(AudienceSegment.id))
        .filter(AudienceSegment.social_account_id == account.id)
        .scalar() or 0
    )

    # ── Latest insight (Gemini summary + actions)
    insight = (
        db.query(InsightResult)
        .filter(InsightResult.social_account_id == account.id)
        .order_by(InsightResult.generated_at.desc())
        .first()
    )
    summary_text = (insight.summary if insight else "") or (
        "No AI-generated summary available yet. Generate one from the Home dashboard "
        "to get a two-sentence weekly audience intelligence summary here."
    )
    raw_actions = (insight.insights if insight and insight.insights else []) or []
    top_actions = raw_actions[:3] if isinstance(raw_actions, list) else []

    # ── Top 5 posts by likes+comments (all-time, but labelled for this account)
    top_posts_rows = (
        db.query(
            Post.id,
            Post.caption,
            Post.content_type,
            Post.posted_at,
            func.coalesce(func.sum(EngagementMetric.likes), 0).label("likes"),
            func.coalesce(func.sum(EngagementMetric.comments), 0).label("comments"),
        )
        .outerjoin(EngagementMetric, EngagementMetric.post_id == Post.id)
        .filter(Post.social_account_id == account.id)
        .group_by(Post.id, Post.caption, Post.content_type, Post.posted_at)
        .order_by((func.coalesce(func.sum(EngagementMetric.likes), 0)
                   + func.coalesce(func.sum(EngagementMetric.comments), 0)).desc())
        .limit(5)
        .all()
    )
    top_posts = [
        {
            "caption": _truncate(r.caption, 50),
            "likes": int(r.likes or 0),
            "comments": int(r.comments or 0),
            "posted_at": r.posted_at,
            "content_type": r.content_type.value if r.content_type else "unknown",
        }
        for r in top_posts_rows
    ]

    return {
        "account_name": account.username or "Instagram account",
        "period_start": wk1_start,
        "period_end": now,
        "generated_at": now,
        "summary": summary_text,
        "kpis": [
            {
                "label": "Total Reach",
                "value": f"{current_reach:,}",
                "delta": _pct_change(current_reach, previous_reach),
            },
            {
                "label": "Avg Engagement Rate",
                "value": f"{current_avg_eng}",
                "delta": _pct_change(current_avg_eng, previous_avg_eng),
            },
            {
                "label": "Sentiment Score",
                "value": f"{sent_score_current}%",
                "delta": _pct_change(sent_score_current, sent_score_previous),
            },
            {
                "label": "Active Segments",
                "value": f"{active_segments}",
                "delta": None,
            },
        ],
        "top_actions": top_actions,
        "top_posts": top_posts,
        "sentiment_counts": sentiment_counts,
        "sentiment_total": total_sent,
    }


# ── PDF rendering ───────────────────────────────────────────

def _wrap_text(c: canvas.Canvas, text: str, max_width: float, font: str, size: int) -> list[str]:
    """Naive word wrap into lines fitting max_width."""
    words = (text or "").split()
    lines: list[str] = []
    current = ""
    for w in words:
        trial = f"{current} {w}".strip()
        if c.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def _draw_wrapped(
    c: canvas.Canvas,
    x: float,
    y: float,
    text: str | None,
    *,
    font: str,
    size: int,
    max_width: float,
    line_height: float,
    right_edge: float | None = None,
    max_lines: int | None = None,
) -> float:
    """Wrap + draw a paragraph. Each line is reshaped + right-aligned if Arabic."""
    if not text:
        return y
    lines = _wrap_text(c, text, max_width, font, size)
    if max_lines is not None:
        lines = lines[:max_lines]
    c.setFont(font, size)
    for line in lines:
        prepared = _prep(line)
        if _contains_arabic(line) and right_edge is not None:
            w = c.stringWidth(prepared, font, size)
            c.drawString(right_edge - w, y, prepared)
        else:
            c.drawString(x, y, prepared)
        y -= line_height
    return y


def _draw_footer(c: canvas.Canvas):
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawCentredString(
        PAGE_W / 2,
        12 * mm,
        "Generated by BASIRET · basiret.io · Confidential",
    )


def _draw_cover(c: canvas.Canvas, data: dict):
    # Big purple band at top
    c.setFillColor(PURPLE)
    c.rect(0, PAGE_H - 90 * mm, PAGE_W, 90 * mm, fill=1, stroke=0)

    # Logo text
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 48)
    c.drawString(MARGIN_X, PAGE_H - 45 * mm, "BASIRET")
    c.setFont("Helvetica", 12)
    c.drawString(MARGIN_X, PAGE_H - 55 * mm, "AI-powered social media analytics")

    # Report title
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(MARGIN_X, PAGE_H - 120 * mm, "Weekly Report")

    # Account name — routes through Arabic font + RTL if the username is Arabic
    c.setFillColor(TEXT)
    account_name = _strip_emoji(data["account_name"] or "")
    if _contains_arabic(account_name):
        # Label stays LTR in Helvetica; username gets reshaped + right-aligned
        c.setFont(FONT_LATIN, 16)
        c.drawString(MARGIN_X, PAGE_H - 135 * mm, "Account:")
        right_edge = PAGE_W - MARGIN_X
        shaped = _shape_ar(f"@{account_name}")
        c.setFont(FONT_AR, 16)
        w = c.stringWidth(shaped, FONT_AR, 16)
        c.drawString(right_edge - w, PAGE_H - 135 * mm, shaped)
    else:
        c.setFont(FONT_LATIN, 16)
        c.drawString(MARGIN_X, PAGE_H - 135 * mm, f"Account: @{account_name}")

    # Period
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 11)
    period = (
        f"Report period: {data['period_start'].strftime('%b %d, %Y')} — "
        f"{data['period_end'].strftime('%b %d, %Y')}"
    )
    c.drawString(MARGIN_X, PAGE_H - 145 * mm, period)
    c.drawString(
        MARGIN_X,
        PAGE_H - 152 * mm,
        f"Generated: {data['generated_at'].strftime('%b %d, %Y · %H:%M UTC')}",
    )

    _draw_footer(c)


def _draw_section_heading(c: canvas.Canvas, y: float, title: str) -> float:
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN_X, y, title)
    c.setStrokeColor(DIVIDER)
    c.setLineWidth(0.5)
    c.line(MARGIN_X, y - 3, PAGE_W - MARGIN_X, y - 3)
    return y - 10 * mm


def _draw_kpi_cards(c: canvas.Canvas, y: float, kpis: list[dict]) -> float:
    card_w = (PAGE_W - 2 * MARGIN_X - 3 * 4 * mm) / 4
    card_h = 28 * mm
    x = MARGIN_X
    for kpi in kpis:
        c.setFillColor(HexColor("#FAF9FC"))
        c.setStrokeColor(DIVIDER)
        c.setLineWidth(0.5)
        c.roundRect(x, y - card_h, card_w, card_h, 4, fill=1, stroke=1)

        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8)
        c.drawString(x + 4 * mm, y - 6 * mm, str(kpi["label"]).upper())

        c.setFillColor(TEXT)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(x + 4 * mm, y - 15 * mm, str(kpi["value"]))

        delta = kpi.get("delta")
        if delta is None:
            c.setFillColor(MUTED)
            c.setFont("Helvetica", 9)
            c.drawString(x + 4 * mm, y - 22 * mm, "vs. last week: —")
        else:
            c.setFillColor(POSITIVE if delta >= 0 else NEGATIVE)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(x + 4 * mm, y - 22 * mm, f"{_format_delta(delta)} vs. last week")

        x += card_w + 4 * mm
    return y - card_h - 6 * mm


def _draw_priority_badge(c: canvas.Canvas, x: float, y: float, priority: str):
    color = {"high": PRIORITY_HIGH, "medium": PRIORITY_MEDIUM, "low": PRIORITY_LOW}.get(
        priority.lower(), PRIORITY_MEDIUM
    )
    label = priority.upper()
    text_w = c.stringWidth(label, "Helvetica-Bold", 8)
    pad = 3 * mm
    w = text_w + 2 * pad
    h = 5 * mm
    c.setFillColor(color)
    c.roundRect(x, y, w, h, 2, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + pad, y + 1.5 * mm, label)
    return w


def _draw_actions(c: canvas.Canvas, y: float, actions: list[dict]) -> float:
    if not actions:
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(MARGIN_X, y, "No AI actions available for this week yet.")
        return y - 10 * mm

    max_w = PAGE_W - 2 * MARGIN_X - 8 * mm
    for action in actions:
        if y < 60 * mm:
            _draw_footer(c)
            c.showPage()
            y = PAGE_H - 25 * mm

        priority = str(action.get("priority", "medium"))
        title = _strip_emoji(action.get("title") or "Action")
        action_text = _strip_emoji(action.get("action") or action.get("finding") or "")
        timeframe = _strip_emoji(action.get("timeframe") or "")

        # Card background
        card_h = 34 * mm
        c.setFillColor(HexColor("#FAF9FC"))
        c.setStrokeColor(DIVIDER)
        c.setLineWidth(0.5)
        c.roundRect(MARGIN_X, y - card_h, PAGE_W - 2 * MARGIN_X, card_h, 4, fill=1, stroke=1)

        inner_x = MARGIN_X + 4 * mm
        inner_right = PAGE_W - MARGIN_X - 4 * mm
        badge_w = _draw_priority_badge(c, inner_x, y - 8 * mm, priority)

        # Title — pick font per-string for Arabic, right-align if Arabic
        title_font = _pick_font(title, bold=True)
        c.setFillColor(TEXT)
        if _contains_arabic(title):
            shaped = _shape_ar(title)
            c.setFont(title_font, 11)
            w = c.stringWidth(shaped, title_font, 11)
            c.drawString(inner_right - w, y - 6.5 * mm, shaped)
        else:
            c.setFont(title_font, 11)
            c.drawString(inner_x + badge_w + 3 * mm, y - 6.5 * mm, title)

        # Action body — wrap with the right font, right-align each Arabic line
        body_font = _pick_font(action_text)
        c.setFillColor(TEXT)
        _draw_wrapped(
            c,
            inner_x,
            y - 15 * mm,
            action_text,
            font=body_font,
            size=10,
            max_width=max_w,
            line_height=5 * mm,
            right_edge=inner_right,
            max_lines=2,
        )

        if timeframe:
            c.setFillColor(MUTED)
            # Timeframe label stays English; value may be Arabic but rare.
            label = "Timeframe: " + str(timeframe)
            tf_font = _pick_font(label, italic=True)
            if _contains_arabic(label):
                shaped = _shape_ar(label)
                c.setFont(tf_font, 9)
                w = c.stringWidth(shaped, tf_font, 9)
                c.drawString(inner_right - w, y - card_h + 3 * mm, shaped)
            else:
                c.setFont(tf_font, 9)
                c.drawString(inner_x, y - card_h + 3 * mm, label)

        y -= card_h + 4 * mm
    return y


def _draw_top_posts(c: canvas.Canvas, y: float, posts: list[dict]) -> float:
    if not posts:
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(MARGIN_X, y, "No posts available yet.")
        return y - 10 * mm

    # Columns: Caption | Likes | Comments | Date | Type
    col_caption = PAGE_W - 2 * MARGIN_X - (18 * mm + 22 * mm + 22 * mm + 22 * mm)
    col_likes_x = MARGIN_X + col_caption
    col_comments_x = col_likes_x + 18 * mm
    col_date_x = col_comments_x + 22 * mm
    col_type_x = col_date_x + 22 * mm

    # Header row
    c.setFillColor(PURPLE)
    c.rect(MARGIN_X, y - 7 * mm, PAGE_W - 2 * MARGIN_X, 7 * mm, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN_X + 3 * mm, y - 5 * mm, "CAPTION")
    c.drawString(col_likes_x, y - 5 * mm, "LIKES")
    c.drawString(col_comments_x, y - 5 * mm, "COMMENTS")
    c.drawString(col_date_x, y - 5 * mm, "DATE")
    c.drawString(col_type_x, y - 5 * mm, "TYPE")
    y -= 7 * mm

    # Rows
    caption_right_edge = col_likes_x - 2 * mm
    for i, p in enumerate(posts):
        row_h = 8 * mm
        if i % 2 == 1:
            c.setFillColor(HexColor("#FAF9FC"))
            c.rect(MARGIN_X, y - row_h, PAGE_W - 2 * MARGIN_X, row_h, fill=1, stroke=0)
        c.setFillColor(TEXT)

        caption = _strip_emoji(p["caption"]) or "—"
        cap_font = _pick_font(caption)
        if _contains_arabic(caption):
            shaped = _shape_ar(caption)
            c.setFont(cap_font, 9)
            w = c.stringWidth(shaped, cap_font, 9)
            c.drawString(caption_right_edge - w, y - 5.5 * mm, shaped)
        else:
            c.setFont(cap_font, 9)
            c.drawString(MARGIN_X + 3 * mm, y - 5.5 * mm, caption)

        # Numeric/Latin-only columns always use Helvetica
        c.setFont("Helvetica", 9)
        c.drawString(col_likes_x, y - 5.5 * mm, f"{p['likes']:,}")
        c.drawString(col_comments_x, y - 5.5 * mm, f"{p['comments']:,}")
        date_str = p["posted_at"].strftime("%b %d") if p["posted_at"] else "—"
        c.drawString(col_date_x, y - 5.5 * mm, date_str)
        c.drawString(col_type_x, y - 5.5 * mm, str(p["content_type"]).capitalize())
        y -= row_h
    return y - 4 * mm


def _draw_sentiment(c: canvas.Canvas, y: float, counts: dict, total: int) -> float:
    if total == 0:
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(MARGIN_X, y, "No analyzed comments yet.")
        return y - 10 * mm

    pct = {k: round(100 * v / total) for k, v in counts.items()}
    bar_w_full = PAGE_W - 2 * MARGIN_X
    bar_h = 10 * mm
    x = MARGIN_X

    # Stacked bar
    segments = [
        ("positive", POSITIVE, pct["positive"]),
        ("neutral", NEUTRAL, pct["neutral"]),
        ("negative", NEGATIVE, pct["negative"]),
    ]
    for _, color, p in segments:
        w = bar_w_full * p / 100
        c.setFillColor(color)
        c.rect(x, y - bar_h, w, bar_h, fill=1, stroke=0)
        x += w

    y -= bar_h + 6 * mm

    # Legend
    legend_x = MARGIN_X
    for label, color, p in segments:
        c.setFillColor(color)
        c.rect(legend_x, y - 3.5 * mm, 4 * mm, 4 * mm, fill=1, stroke=0)
        c.setFillColor(TEXT)
        c.setFont("Helvetica", 10)
        c.drawString(legend_x + 6 * mm, y - 3 * mm, f"{label.capitalize()}: {p}% ({counts[label]})")
        legend_x += 60 * mm

    return y - 10 * mm


def _render_pdf(data: dict) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"BASIRET Weekly Report — {data['account_name']}")

    # ── Page 1: Cover
    _draw_cover(c, data)
    c.showPage()

    # ── Page 2+: Content
    y = PAGE_H - 25 * mm

    # Executive summary — Gemini output can be EN or AR; auto-detect per string
    y = _draw_section_heading(c, y, "Executive Summary")
    c.setFillColor(TEXT)
    summary_text = data["summary"] or ""
    body_font = _pick_font(summary_text)
    y = _draw_wrapped(
        c,
        MARGIN_X,
        y,
        summary_text,
        font=body_font,
        size=10,
        max_width=PAGE_W - 2 * MARGIN_X,
        line_height=5 * mm,
        right_edge=PAGE_W - MARGIN_X,
        max_lines=6,
    )
    y -= 4 * mm

    # Performance overview
    y = _draw_section_heading(c, y, "Performance Overview")
    y = _draw_kpi_cards(c, y, data["kpis"])

    # Top 3 actions
    y = _draw_section_heading(c, y, "Top 3 Actions")
    y = _draw_actions(c, y, data["top_actions"])

    # Check remaining space — if tight, new page
    if y < 90 * mm:
        _draw_footer(c)
        c.showPage()
        y = PAGE_H - 25 * mm

    # Content performance
    y = _draw_section_heading(c, y, "Content Performance — Top 5 Posts")
    y = _draw_top_posts(c, y, data["top_posts"])

    # Sentiment breakdown
    if y < 60 * mm:
        _draw_footer(c)
        c.showPage()
        y = PAGE_H - 25 * mm
    y = _draw_section_heading(c, y, "Sentiment Breakdown")
    y = _draw_sentiment(c, y, data["sentiment_counts"], data["sentiment_total"])

    _draw_footer(c)
    c.save()
    return buf.getvalue()


# ── Endpoint ────────────────────────────────────────────────

@router.get("/weekly")
def weekly_report(
    account_id: str,
    user: User = Depends(RequireFeature("content_recommendations")),
    db: Session = Depends(get_db),
):
    """Generate and return a weekly PDF report for the given account (Pro)."""
    try:
        account_uuid = UUID(account_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid account_id")

    account = (
        db.query(SocialAccount)
        .filter(SocialAccount.id == account_uuid)
        .filter(SocialAccount.organization_id == user.organization_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Social account not found")

    data = _gather_report_data(db, account)
    pdf_bytes = _render_pdf(data)

    safe_username = (account.username or "account").replace(" ", "_")
    date_str = data["generated_at"].strftime("%Y%m%d")
    filename = f"basiret-weekly-{safe_username}-{date_str}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
