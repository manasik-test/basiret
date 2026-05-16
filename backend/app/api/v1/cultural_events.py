"""GET /api/v1/cultural-events — account-scoped cultural calendar lookup.

Returns active cultural events overlapping a date window for a given country.
Resolves stored event definitions (fixed_gregorian / lunar_hijri /
seasonal_range) into concrete Gregorian (start, end) ranges at request time.

Auth: any authenticated user.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.hijri import resolve_event_dates_for_range
from app.models.cultural_event import CulturalEvent
from app.models.user import User


router = APIRouter()


VALID_COUNTRY_ISO = frozenset({"SA", "AE", "QA", "KW", "OM", "BH"})
DEFAULT_WINDOW_DAYS = 90


# ── Response shapes ────────────────────────────────────────────

class CulturalEventOccurrence(BaseModel):
    """One concrete (start, end) Gregorian span derived from an event."""
    start_date: str
    end_date: str
    duration_days: int


class CulturalEventResponse(BaseModel):
    """Per-event payload for the list endpoint."""
    event_key: str
    name: str  # localized (name_en or name_ar based on ?language=)
    name_en: str
    name_ar: str
    country_iso: str | None
    event_type: str
    category: str
    resolved_dates: list[CulturalEventOccurrence]
    cultural_significance: int
    lead_time_days: int
    audience_behavior: dict[str, Any]
    content_guidelines: dict[str, Any]
    industries_high_relevance: list[str]
    year_specific_notes: dict[str, Any] | None
    source_confidence: str
    source_url: str | None
    is_active: bool


# ── Helpers ────────────────────────────────────────────────────

def _derive_category(ev: CulturalEvent) -> str:
    """Map event_type + country_iso to a coarse display category.

    Derivation-only — not a stored column. If/when richer categorization is
    needed (e.g. distinguishing 'heritage' from 'commercial' inside
    seasonal_range), add an explicit ``category`` column via migration.

    - lunar_hijri → "religious"
    - fixed_gregorian + country_iso → "national"
    - fixed_gregorian + NULL country → "secular_observance"
    - seasonal_range → "seasonal"
    """
    if ev.event_type == "lunar_hijri":
        return "religious"
    if ev.event_type == "fixed_gregorian":
        return "national" if ev.country_iso else "secular_observance"
    return "seasonal"


def _serialize(ev: CulturalEvent, language: str, ranges: list[tuple[date, date]]) -> dict:
    return {
        "event_key": ev.event_key,
        "name": ev.name_ar if language == "ar" else ev.name_en,
        "name_en": ev.name_en,
        "name_ar": ev.name_ar,
        "country_iso": ev.country_iso,
        "event_type": ev.event_type,
        "category": _derive_category(ev),
        "resolved_dates": [
            {
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "duration_days": (end - start).days + 1,
            }
            for start, end in ranges
        ],
        "cultural_significance": ev.cultural_significance,
        "lead_time_days": ev.lead_time_days,
        "audience_behavior": ev.audience_behavior,
        "content_guidelines": ev.content_guidelines,
        "industries_high_relevance": list(ev.industries_high_relevance or []),
        "year_specific_notes": ev.year_specific_notes,
        "source_confidence": ev.source_confidence,
        "source_url": ev.source_url,
        "is_active": ev.is_active,
    }


# ── Endpoint ───────────────────────────────────────────────────

@router.get("")
def list_cultural_events(
    country_iso: str = Query(..., description="ISO-2 GCC code: SA/AE/QA/KW/OM/BH"),
    from_date: date | None = Query(None, description="ISO date; defaults to today"),
    to_date: date | None = Query(None, description="ISO date; defaults to today+90d"),
    language: Literal["en", "ar"] = Query("en"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    # Validate country_iso against allowlist. (FastAPI's Query(...) covers
    # the missing-param case as 422; this 400 fires for unrecognized codes.)
    if country_iso not in VALID_COUNTRY_ISO:
        raise HTTPException(
            status_code=400,
            detail=f"country_iso must be one of {sorted(VALID_COUNTRY_ISO)}",
        )

    today = date.today()
    if from_date is None:
        from_date = today
    if to_date is None:
        to_date = today + timedelta(days=DEFAULT_WINDOW_DAYS)

    if from_date > to_date:
        raise HTTPException(
            status_code=400,
            detail=f"from_date ({from_date.isoformat()}) must be <= to_date ({to_date.isoformat()})",
        )

    # Country-scoped or cross-GCC shared (country_iso IS NULL). Only active.
    events = (
        db.query(CulturalEvent)
        .filter(CulturalEvent.is_active.is_(True))
        .filter(
            or_(
                CulturalEvent.country_iso == country_iso,
                CulturalEvent.country_iso.is_(None),
            )
        )
        .all()
    )

    # Resolve each event into windowed (start, end) ranges; drop events with none.
    items: list[dict] = []
    for ev in events:
        ranges = resolve_event_dates_for_range(
            event_type=ev.event_type,
            from_date=from_date,
            to_date=to_date,
            gregorian_month=ev.gregorian_month,
            gregorian_day=ev.gregorian_day,
            hijri_month=ev.hijri_month,
            hijri_day=ev.hijri_day,
            seasonal_start_month=ev.seasonal_start_month,
            seasonal_end_month=ev.seasonal_end_month,
            duration_days=ev.duration_days,
        )
        if not ranges:
            continue
        items.append(_serialize(ev, language, ranges))

    # Sort ASC by earliest resolved start_date.
    items.sort(key=lambda r: r["resolved_dates"][0]["start_date"])

    return {
        "success": True,
        "data": {
            "events": items,
            "window": {
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "country_iso": country_iso,
                "language": language,
                "total": len(items),
            },
        },
    }
