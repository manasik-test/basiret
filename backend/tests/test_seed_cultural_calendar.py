"""Phase 1D — cultural_calendar seeding script tests.

Tests run against the live Postgres container (no SQLite, no mocks) per
project convention. Each test wipes ``cultural_event`` rows BEFORE running
so the assertions are deterministic regardless of prior test order.

After the suite finishes, the last test leaves a fully-seeded
``cultural_event`` table (51 rows) — which is the intended post-test state.
"""
from __future__ import annotations

from datetime import date

import pytest

from app.core.database import SessionLocal
from app.models.cultural_event import CulturalEvent
from scripts.seed_cultural_calendar import (
    SEED_FILE,
    seed_cultural_calendar,
)


# ── Fixture: ensure cultural_event starts empty for each test ──

@pytest.fixture()
def clean_db():
    """Wipe cultural_event before yielding a session; close it after."""
    db = SessionLocal()
    db.query(CulturalEvent).delete()
    db.commit()
    try:
        yield db
    finally:
        db.close()


# ── Sanity: seed file is in place and parseable ────────────────

def test_seed_file_exists():
    assert SEED_FILE.exists(), f"Seed file not found at {SEED_FILE}"


# ── 1. Initial seed inserts every entry ────────────────────────

def test_initial_seed_inserts_all_entries(clean_db):
    result = seed_cultural_calendar(clean_db)
    assert result["total"] == result["inserted"]
    assert result["updated"] == 0
    assert result["unchanged"] == 0
    # 51 entries expected as of Batch 2; the test asserts equality with the
    # file's own total, so adding entries later doesn't require a test edit.
    db_count = clean_db.query(CulturalEvent).count()
    assert db_count == result["total"]


# ── 2. Idempotency — second run is a no-op ────────────────────

def test_idempotent_when_no_changes(clean_db):
    first = seed_cultural_calendar(clean_db)
    second = seed_cultural_calendar(clean_db)
    assert second["inserted"] == 0
    assert second["updated"] == 0
    assert second["unchanged"] == first["total"]


# ── 3. Update detection — modified row gets updated ────────────

def test_update_detection(clean_db):
    seed_cultural_calendar(clean_db)
    # Mutate one row out-of-band to make it differ from the JSON
    row = (
        clean_db.query(CulturalEvent)
        .filter(CulturalEvent.event_key == "ramadan")
        .one()
    )
    row.cultural_significance = 1  # JSON has 10
    clean_db.commit()

    result = seed_cultural_calendar(clean_db)
    assert result["updated"] == 1
    assert result["inserted"] == 0

    # And the value was actually reset to what the JSON declares
    clean_db.refresh(row)
    assert row.cultural_significance == 10


# ── 4. is_active=false rows ARE seeded (just inactive) ─────────

def test_is_active_false_entries_seeded(clean_db):
    seed_cultural_calendar(clean_db)
    spring = (
        clean_db.query(CulturalEvent)
        .filter(CulturalEvent.event_key == "spring_of_culture")
        .one()
    )
    assert spring.is_active is False, (
        "spring_of_culture should be seeded with is_active=False per "
        "_curation_rules.uncertain_event_rule (2026 edition postponed)"
    )
    # And the row IS present in the table — inactive, not absent
    assert spring.event_key == "spring_of_culture"


# ── 5. Active entries default to is_active=True ────────────────

def test_active_entries_default_to_true(clean_db):
    seed_cultural_calendar(clean_db)
    # Batch 1 entries don't set is_active in JSON; should default to True
    ramadan = (
        clean_db.query(CulturalEvent)
        .filter(CulturalEvent.event_key == "ramadan")
        .one()
    )
    assert ramadan.is_active is True


# ── 6. All event_keys from JSON end up in DB ───────────────────

def test_all_event_keys_seeded(clean_db):
    import json
    with open(SEED_FILE, encoding="utf-8") as f:
        data = json.load(f)
    json_keys = {e["event_key"] for e in data["entries"]}

    seed_cultural_calendar(clean_db)
    db_keys = {
        ek for (ek,) in clean_db.query(CulturalEvent.event_key).all()
    }
    assert db_keys == json_keys, (
        f"Missing in DB: {json_keys - db_keys}; extra in DB: {db_keys - json_keys}"
    )


# ── 7. JSONB fields round-trip correctly ───────────────────────

def test_jsonb_fields_preserved(clean_db):
    seed_cultural_calendar(clean_db)
    saudi_nd = (
        clean_db.query(CulturalEvent)
        .filter(CulturalEvent.event_key == "saudi_national_day")
        .one()
    )
    # content_guidelines is a dict with array values; verify nested shape
    cg = saudi_nd.content_guidelines
    assert isinstance(cg, dict)
    assert isinstance(cg.get("avoid"), list)
    assert len(cg["avoid"]) > 0
    assert any("foreign visual elements" in s for s in cg["avoid"])

    ab = saudi_nd.audience_behavior
    assert isinstance(ab, dict)
    assert "peak_hours" in ab
    assert "engagement_shift" in ab


# ── 8. last_verified coerced to date object ────────────────────

def test_last_verified_is_date_object(clean_db):
    seed_cultural_calendar(clean_db)
    any_row = clean_db.query(CulturalEvent).first()
    assert isinstance(any_row.last_verified, date)


# ── 9. Hajj is the shared one (Batch 1 fix verified at DB level) ─

def test_hajj_is_shared_with_correct_industries(clean_db):
    seed_cultural_calendar(clean_db)
    hajj = (
        clean_db.query(CulturalEvent)
        .filter(CulturalEvent.event_key == "hajj_season")
        .one()
    )
    assert hajj.country_iso is None, "Hajj should be shared (country_iso=NULL)"
    assert "travel_agency" in hajj.industries_high_relevance
    assert "religious_tourism" in hajj.industries_high_relevance
    assert "alcohol_beverage" in hajj.content_guidelines["industries_low_relevance"]
