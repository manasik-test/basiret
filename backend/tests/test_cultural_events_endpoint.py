"""Phase 1E — GET /api/v1/cultural-events endpoint tests.

Runs against the live Postgres container with the canonical seed JSON
applied via the Phase 1D seeder. The session-scoped fixture below ensures
the table is seeded once before these tests run; tests don't mutate the
seeded rows.
"""
from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import patch

import pytest

from app.core.database import SessionLocal
from app.models.cultural_event import CulturalEvent
from scripts.seed_cultural_calendar import seed_cultural_calendar


# ── Fixture: ensure cultural_event is fully seeded before tests ─

@pytest.fixture(scope="module", autouse=True)
def _seeded_cultural_events():
    """Make sure all 51 canonical entries are present in cultural_event.

    Idempotent — no-op if seed already up to date. Does NOT wipe the table
    on exit; the seeded state IS the desired post-test state.
    """
    db = SessionLocal()
    try:
        seed_cultural_calendar(db)
    finally:
        db.close()
    yield


# ── Helpers ────────────────────────────────────────────────────

def _get(client, token: str | None = None, **params):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.get("/api/v1/cultural-events", params=params, headers=headers)


# ── 1. Auth ────────────────────────────────────────────────────

def test_unauthenticated_returns_403(client):
    """HTTPBearer without a token returns 403 (project pattern — see other
    auth tests in test_protected_routes.py)."""
    resp = client.get("/api/v1/cultural-events", params={"country_iso": "SA"})
    assert resp.status_code == 403


# ── 2. Query param validation ─────────────────────────────────

def test_missing_country_iso_returns_422(client, starter_user):
    _, _, token = starter_user
    resp = _get(client, token)
    # FastAPI returns 422 for missing required query params
    assert resp.status_code == 422


@pytest.mark.parametrize("bad_iso", ["XX", "us", "USA", ""])
def test_invalid_country_iso_returns_400(client, starter_user, bad_iso):
    _, _, token = starter_user
    resp = _get(client, token, country_iso=bad_iso)
    assert resp.status_code == 400
    assert "country_iso" in resp.json()["detail"]


def test_from_after_to_returns_400(client, starter_user):
    _, _, token = starter_user
    resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-06-30",
        to_date="2026-06-01",
    )
    assert resp.status_code == 400
    assert "from_date" in resp.json()["detail"]


# ── 3. Country scoping ────────────────────────────────────────

def test_shared_event_returned_for_any_country(client, starter_user):
    """Ramadan (country_iso=NULL) appears in queries for any country."""
    _, _, token = starter_user
    keys_by_country = {}
    for iso in ["SA", "AE", "QA", "KW", "OM", "BH"]:
        resp = _get(
            client, token,
            country_iso=iso,
            from_date="2026-02-01",
            to_date="2026-04-30",
        )
        assert resp.status_code == 200
        keys_by_country[iso] = {
            e["event_key"] for e in resp.json()["data"]["events"]
        }
    # Ramadan (Feb 18 → Mar 19 in UMQ 2026) is a shared lunar event
    for iso, keys in keys_by_country.items():
        assert "ramadan" in keys, f"Ramadan missing for {iso}"


def test_country_filters_exclude_other_countries(client, starter_user):
    """SA query should NOT return UAE-only events; AE query should NOT return
    SA-only events. Shared (NULL) still appears in both."""
    _, _, token = starter_user
    # Wide window covering UAE National Day (Dec 2) + Saudi National Day (Sep 23)
    sa_resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-01-01",
        to_date="2026-12-31",
    )
    ae_resp = _get(
        client, token,
        country_iso="AE",
        from_date="2026-01-01",
        to_date="2026-12-31",
    )
    sa_keys = {e["event_key"] for e in sa_resp.json()["data"]["events"]}
    ae_keys = {e["event_key"] for e in ae_resp.json()["data"]["events"]}

    assert "saudi_national_day" in sa_keys
    assert "saudi_national_day" not in ae_keys
    assert "uae_national_day" in ae_keys
    assert "uae_national_day" not in sa_keys
    # Shared events present in both
    assert "ramadan" in sa_keys and "ramadan" in ae_keys


# ── 4. Date window filtering ──────────────────────────────────

def test_fixed_event_in_window_returned(client, starter_user):
    """Saudi National Day Sep 23 falls in a Jun→Dec 2026 window."""
    _, _, token = starter_user
    resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-06-01",
        to_date="2026-12-31",
    )
    events = resp.json()["data"]["events"]
    snd = next((e for e in events if e["event_key"] == "saudi_national_day"), None)
    assert snd is not None
    assert snd["resolved_dates"] == [
        {"start_date": "2026-09-23", "end_date": "2026-09-23", "duration_days": 1}
    ]


def test_fixed_event_outside_window_excluded(client, starter_user):
    """Saudi National Day Sep 23 absent in Jan→Jun 2026 window."""
    _, _, token = starter_user
    resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-01-01",
        to_date="2026-06-30",
    )
    keys = {e["event_key"] for e in resp.json()["data"]["events"]}
    assert "saudi_national_day" not in keys


def test_lunar_event_resolves_to_correct_dates(client, starter_user):
    """Ramadan 1447 AH per UMQ = Feb 18 → Mar 19 2026."""
    _, _, token = starter_user
    resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-02-01",
        to_date="2026-03-31",
    )
    events = resp.json()["data"]["events"]
    ramadan = next(e for e in events if e["event_key"] == "ramadan")
    assert ramadan["resolved_dates"] == [
        {"start_date": "2026-02-18", "end_date": "2026-03-19", "duration_days": 30}
    ]


def test_seasonal_event_overlapping_window_returned(client, starter_user):
    """Riyadh Season (Oct-Mar wraparound) overlaps a Jan-Feb 2026 window."""
    _, _, token = starter_user
    resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-01-15",
        to_date="2026-02-28",
    )
    keys = {e["event_key"] for e in resp.json()["data"]["events"]}
    assert "riyadh_season" in keys


# ── 5. is_active filtering ────────────────────────────────────

def test_inactive_event_never_returned(client, starter_user):
    """spring_of_culture has is_active=False — should never appear."""
    _, _, token = starter_user
    # Use a window where Spring of Culture (Mar-May) would otherwise overlap
    resp = _get(
        client, token,
        country_iso="BH",
        from_date="2026-03-01",
        to_date="2026-05-31",
    )
    keys = {e["event_key"] for e in resp.json()["data"]["events"]}
    assert "spring_of_culture" not in keys, (
        "Inactive event leaked through despite is_active=False filter"
    )


# ── 6. Language parameter ─────────────────────────────────────

def test_language_param_switches_name_field(client, starter_user):
    """?language=ar swaps the `name` field to name_ar; en uses name_en.
    name_en and name_ar are always present regardless."""
    _, _, token = starter_user

    en_resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-02-01",
        to_date="2026-03-31",
        language="en",
    )
    ar_resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-02-01",
        to_date="2026-03-31",
        language="ar",
    )
    en_ramadan = next(
        e for e in en_resp.json()["data"]["events"] if e["event_key"] == "ramadan"
    )
    ar_ramadan = next(
        e for e in ar_resp.json()["data"]["events"] if e["event_key"] == "ramadan"
    )
    assert en_ramadan["name"] == en_ramadan["name_en"] == "Ramadan"
    assert ar_ramadan["name"] == ar_ramadan["name_ar"]
    assert "رمضان" in ar_ramadan["name"]
    # Both directions still expose both fields
    assert en_ramadan["name_ar"] == ar_ramadan["name_ar"]


def test_language_defaults_to_en(client, starter_user):
    _, _, token = starter_user
    resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-02-01",
        to_date="2026-03-31",
    )
    ramadan = next(
        e for e in resp.json()["data"]["events"] if e["event_key"] == "ramadan"
    )
    assert ramadan["name"] == ramadan["name_en"]


# ── 7. Sort + envelope ────────────────────────────────────────

def test_resolved_dates_sorted_ascending(client, starter_user):
    """Across all returned events, the array is sorted by earliest
    start_date ASC."""
    _, _, token = starter_user
    resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-01-01",
        to_date="2026-12-31",
    )
    starts = [
        e["resolved_dates"][0]["start_date"]
        for e in resp.json()["data"]["events"]
    ]
    assert starts == sorted(starts), f"Not sorted: {starts}"


def test_response_envelope_shape(client, starter_user):
    """{success, data: {events, window: {...}}}."""
    _, _, token = starter_user
    resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-09-01",
        to_date="2026-09-30",
    )
    body = resp.json()
    assert body["success"] is True
    assert "events" in body["data"]
    assert "window" in body["data"]
    window = body["data"]["window"]
    assert window["country_iso"] == "SA"
    assert window["from_date"] == "2026-09-01"
    assert window["to_date"] == "2026-09-30"
    assert window["language"] == "en"
    assert window["total"] == len(body["data"]["events"])


def test_event_response_includes_jsonb_fields(client, starter_user):
    """The response includes the full JSONB content_guidelines + audience_behavior."""
    _, _, token = starter_user
    resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-09-01",
        to_date="2026-09-30",
    )
    snd = next(
        e for e in resp.json()["data"]["events"]
        if e["event_key"] == "saudi_national_day"
    )
    assert isinstance(snd["content_guidelines"], dict)
    assert "avoid" in snd["content_guidelines"]
    assert isinstance(snd["content_guidelines"]["avoid"], list)
    assert isinstance(snd["audience_behavior"], dict)
    assert "peak_hours" in snd["audience_behavior"]
    assert isinstance(snd["industries_high_relevance"], list)
    # Category derivation
    assert snd["category"] == "national"  # fixed_gregorian + country_iso


def test_category_derivation_for_each_type(client, starter_user):
    """lunar_hijri→religious, fixed+country→national, fixed+null→secular_observance,
    seasonal→seasonal."""
    _, _, token = starter_user
    resp = _get(
        client, token,
        country_iso="SA",
        from_date="2026-01-01",
        to_date="2026-12-31",
    )
    by_key = {e["event_key"]: e for e in resp.json()["data"]["events"]}
    # Spot check across the four derivation buckets
    if "ramadan" in by_key:
        assert by_key["ramadan"]["category"] == "religious"
    if "saudi_national_day" in by_key:
        assert by_key["saudi_national_day"]["category"] == "national"
    if "new_year_eve" in by_key:
        assert by_key["new_year_eve"]["category"] == "secular_observance"
    if "riyadh_season" in by_key:
        assert by_key["riyadh_season"]["category"] == "seasonal"


# ── 8. Empty-result handling ──────────────────────────────────

def test_empty_window_returns_empty_events_not_404(client, starter_user):
    """A window where no events fall should return 200 with an empty events
    array — not 404."""
    _, _, token = starter_user
    # A 1-day window where nothing happens (mid-week random date).
    resp = _get(
        client, token,
        country_iso="KW",
        from_date="2026-06-15",
        to_date="2026-06-15",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    # Could be empty or contain shared climate signals like summer_heat_peak —
    # the assertion is "no 404", not "exactly empty"
    assert isinstance(body["data"]["events"], list)


# ── 9. Default window ─────────────────────────────────────────

def test_default_window_is_today_to_today_plus_90(client, starter_user):
    """When from_date and to_date are omitted, the window should be
    [today, today+90d]. We assert via the window echo in the response."""
    _, _, token = starter_user
    # Freeze "today" via patching date.today inside the endpoint module
    fixed_today = date(2026, 6, 1)

    with patch("app.api.v1.cultural_events.date") as mock_date:
        # Make date.today() return our fixture but otherwise behave normally.
        mock_date.today.return_value = fixed_today
        # All other date() construction passes through
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        mock_date.fromisoformat.side_effect = date.fromisoformat
        mock_date.fromordinal.side_effect = date.fromordinal

        resp = _get(client, token, country_iso="SA")

    assert resp.status_code == 200
    window = resp.json()["data"]["window"]
    assert window["from_date"] == "2026-06-01"
    assert window["to_date"] == "2026-08-30"  # +90 days


# ── 10. Insights-tier user also works (auth is "any role") ────

def test_insights_user_can_query(client, insights_user):
    _, _, token = insights_user
    resp = _get(
        client, token,
        country_iso="AE",
        from_date="2026-12-01",
        to_date="2026-12-31",
    )
    assert resp.status_code == 200
    keys = {e["event_key"] for e in resp.json()["data"]["events"]}
    assert "uae_national_day" in keys
