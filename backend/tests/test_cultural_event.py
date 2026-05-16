"""Phase 1A — cultural_event table + model integration tests.

Runs against the live Postgres container (no SQLite, no mocks) per the
project test convention. Each test cleans up its own row(s); no shared
fixtures are needed because the model has no FKs into the rest of the
schema.
"""
from datetime import date

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import DataError, IntegrityError

from app.core.database import SessionLocal
from app.models.cultural_event import CulturalEvent


# ── Helpers ─────────────────────────────────────────────────────

def _base_kwargs(**overrides) -> dict:
    """Minimal valid row for a fixed_gregorian event. Tests override fields."""
    base = dict(
        event_key=f"test_event_{overrides.pop('_suffix', 'x')}",
        name_en="Test Event",
        name_ar="حدث اختبار",
        country_iso="SA",
        event_type="fixed_gregorian",
        gregorian_month=9,
        gregorian_day=23,
        cultural_significance=8,
        content_guidelines={
            "avoid": ["foreign symbols", "irreverent humor"],
            "prefer": ["green", "white", "national heritage"],
            "tone": ["patriotic", "respectful"],
            "best_post_times": ["09:00", "20:00"],
            "industries_neutral": [],
            "industries_low_relevance": [],
        },
        audience_behavior={
            "peak_hours": "18:00-23:00",
            "engagement_shift": "evening_heavy",
            "shopping_behavior": "spike",
            "social_media_activity": "+40%",
        },
        last_verified=date(2026, 5, 16),
    )
    base.update(overrides)
    return base


def _cleanup(db, event_key: str):
    db.query(CulturalEvent).filter(CulturalEvent.event_key == event_key).delete()
    db.commit()


# ── 1. Migration applied (table + indexes present) ─────────────

def test_table_and_indexes_present():
    db = SessionLocal()
    try:
        insp = inspect(db.bind)
        assert "cultural_event" in insp.get_table_names()
        index_names = {ix["name"] for ix in insp.get_indexes("cultural_event")}
        assert {
            "idx_cultural_event_country_significance",
            "idx_cultural_event_type",
            "idx_cultural_event_updated",
        }.issubset(index_names)
    finally:
        db.close()


# ── 2. Unique constraint on event_key ──────────────────────────

def test_event_key_must_be_unique():
    db = SessionLocal()
    try:
        kwargs = _base_kwargs(_suffix="unique_a", event_key="dup_test_key")
        db.add(CulturalEvent(**kwargs))
        db.commit()

        # second insert with same key must fail
        db.add(CulturalEvent(**_base_kwargs(_suffix="unique_b", event_key="dup_test_key")))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
    finally:
        _cleanup(db, "dup_test_key")
        db.close()


# ── 3. Fixed-gregorian row without date columns is rejected ────

def test_fixed_gregorian_requires_date_columns():
    db = SessionLocal()
    try:
        kwargs = _base_kwargs(_suffix="missing_date", event_key="missing_date_test")
        kwargs["gregorian_month"] = None
        kwargs["gregorian_day"] = None
        db.add(CulturalEvent(**kwargs))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
    finally:
        # cleanup not strictly needed (insert failed) but keep symmetry
        _cleanup(db, "missing_date_test")
        db.close()


# ── 4. Lunar-hijri with invalid hijri_month is rejected ────────

def test_lunar_hijri_rejects_invalid_month():
    db = SessionLocal()
    try:
        kwargs = _base_kwargs(_suffix="bad_hijri", event_key="bad_hijri_test")
        kwargs.update(
            event_type="lunar_hijri",
            gregorian_month=None,
            gregorian_day=None,
            hijri_month=13,  # invalid — must be 1..12
            hijri_day=1,
        )
        db.add(CulturalEvent(**kwargs))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
    finally:
        _cleanup(db, "bad_hijri_test")
        db.close()


# ── 5. cultural_significance out of range is rejected ──────────

def test_significance_out_of_range_rejected():
    db = SessionLocal()
    try:
        kwargs = _base_kwargs(_suffix="big_sig", event_key="big_sig_test")
        kwargs["cultural_significance"] = 11
        db.add(CulturalEvent(**kwargs))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
    finally:
        _cleanup(db, "big_sig_test")
        db.close()


# ── 6. JSONB round-trip preserves nested arrays ────────────────

def test_jsonb_roundtrip_preserves_nested_arrays():
    db = SessionLocal()
    try:
        guidelines = {
            "avoid": ["public daytime eating", "loud parties", "irreverent humor"],
            "prefer": ["family scenes", "iftar tables", "gold/green palette"],
            "tone": ["reverent", "warm"],
            "best_post_times": ["19:30", "21:00", "23:00"],
            "industries_neutral": ["b2b_saas"],
            "industries_low_relevance": ["nightclubs"],
        }
        behavior = {
            "peak_hours": "20:00-02:00",
            "engagement_shift": "evening_heavy",
            "shopping_behavior": "night_centered",
            "social_media_activity": "+35%",
            "food_delivery_spike": "extreme",
        }
        kwargs = _base_kwargs(
            _suffix="jsonb_rt",
            event_key="jsonb_rt_test",
            event_type="lunar_hijri",
            gregorian_month=None,
            gregorian_day=None,
            hijri_month=9,
            hijri_day=1,
            duration_days=30,
            content_guidelines=guidelines,
            audience_behavior=behavior,
            year_specific_notes={"2026": "winter Ramadan — cooler evenings"},
            country_iso=None,  # shared
        )
        ev = CulturalEvent(**kwargs)
        db.add(ev)
        db.commit()

        fetched = db.query(CulturalEvent).filter(
            CulturalEvent.event_key == "jsonb_rt_test"
        ).one()
        assert fetched.content_guidelines == guidelines
        assert fetched.audience_behavior == behavior
        assert fetched.year_specific_notes == {"2026": "winter Ramadan — cooler evenings"}
        assert fetched.country_iso is None
        assert fetched.duration_days == 30
        assert fetched.is_active is True
    finally:
        _cleanup(db, "jsonb_rt_test")
        db.close()


# ── 7. Bonus: invalid country_iso rejected ─────────────────────

def test_invalid_country_iso_rejected():
    db = SessionLocal()
    try:
        # Use raw SQL — SQLAlchemy column is String(2) so it accepts US, but
        # the CHECK constraint at the DB layer must still reject it.
        with pytest.raises((IntegrityError, DataError)):
            db.execute(text(
                "INSERT INTO cultural_event "
                "(event_key, name_en, name_ar, country_iso, event_type, "
                " gregorian_month, gregorian_day, cultural_significance, "
                " content_guidelines, audience_behavior, last_verified) "
                "VALUES ('bad_country_test', 'x', 'x', 'US', 'fixed_gregorian', "
                " 7, 4, 5, '{}'::jsonb, '{}'::jsonb, '2026-05-16')"
            ))
            db.commit()
        db.rollback()
    finally:
        db.execute(text(
            "DELETE FROM cultural_event WHERE event_key = 'bad_country_test'"
        ))
        db.commit()
        db.close()
