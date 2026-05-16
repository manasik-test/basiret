"""Phase 1B — Hijri utility tests.

Positive path: round-trip + known UMQ anchor dates.
Negative path: every documented validation rule is exercised. Negative-path
coverage is intentional — the Phase 1A NULL/BETWEEN bug was caught only
because we asserted rejection of bad inputs, not just acceptance of good
ones.

The anchor dates below come from the official Umm al-Qura calendar (Saudi
civil calendar). They may differ by ±1 day from sighting-based religious
observance announcements — the test pins UMQ, which is what the library
implements.
"""
from datetime import date

import pytest

from app.core.hijri import (
    MAX_GREGORIAN_YEAR,
    MAX_HIJRI_YEAR,
    MIN_GREGORIAN_YEAR,
    MIN_HIJRI_YEAR,
    gregorian_to_hijri,
    hijri_to_gregorian,
    lunar_event_in_gregorian_year,
    resolve_event_dates,
)


# ── POSITIVE: primitive conversions ────────────────────────────

def test_hijri_to_gregorian_ramadan_1447():
    """1 Ramadan 1447 AH per UMQ = 18 February 2026."""
    assert hijri_to_gregorian(1447, 9, 1) == date(2026, 2, 18)


def test_hijri_to_gregorian_eid_al_fitr_1447():
    """1 Shawwal 1447 AH (Eid al-Fitr) per UMQ = 20 March 2026."""
    assert hijri_to_gregorian(1447, 10, 1) == date(2026, 3, 20)


def test_gregorian_to_hijri_roundtrip():
    """Convert a Gregorian date → Hijri → back to Gregorian, expect equality."""
    g = date(2026, 5, 16)
    hy, hm, hd = gregorian_to_hijri(g)
    assert hijri_to_gregorian(hy, hm, hd) == g


# ── POSITIVE: lunar_event_in_gregorian_year ────────────────────

def test_lunar_event_ramadan_1_in_2026():
    """1 Ramadan falls once in 2026 (Feb 18, per UMQ 1447 AH)."""
    occurrences = lunar_event_in_gregorian_year(9, 1, 2026)
    assert occurrences == [date(2026, 2, 18)]


def test_lunar_event_can_return_zero_for_30day_in_29day_month():
    """Hijri day 30 in a Hijri month that's only 29 days that year returns []
    for that occurrence. We test by picking a year where neither Hijri year
    overlapping 2026 has a day 30 in some specific month — if both happen to,
    the test asserts a non-empty list, which is also fine. The contract is:
    *no exception* even when the day is invalid for a particular Hijri year."""
    # The function must not raise for hd=30, even though some Hijri months
    # only have 29 days. Whatever it returns, it must be a list of dates.
    result = lunar_event_in_gregorian_year(2, 30, 2026)
    assert isinstance(result, list)
    for d in result:
        assert d.year == 2026


# ── POSITIVE: resolve_event_dates fixed_gregorian ──────────────

def test_resolve_fixed_gregorian_saudi_national_day():
    """Saudi National Day 2026 = Sep 23, single-day duration."""
    ranges = resolve_event_dates(
        event_type="fixed_gregorian",
        year=2026,
        gregorian_month=9,
        gregorian_day=23,
        duration_days=1,
    )
    assert ranges == [(date(2026, 9, 23), date(2026, 9, 23))]


def test_resolve_fixed_gregorian_with_multi_day_duration():
    """Multi-day fixed event spans correctly."""
    ranges = resolve_event_dates(
        event_type="fixed_gregorian",
        year=2026,
        gregorian_month=12,
        gregorian_day=2,
        duration_days=3,
    )
    assert ranges == [(date(2026, 12, 2), date(2026, 12, 4))]


# ── POSITIVE: resolve_event_dates lunar_hijri ──────────────────

def test_resolve_lunar_ramadan_2026_full_month():
    """Ramadan 1447 AH spans Feb 18 → Mar 19 2026 (UMQ has it as 30 days)."""
    ranges = resolve_event_dates(
        event_type="lunar_hijri",
        year=2026,
        hijri_month=9,
        hijri_day=1,
        duration_days=30,
    )
    # Exactly one occurrence in 2026, starting Feb 18, ending Mar 19.
    assert len(ranges) == 1
    start, end = ranges[0]
    assert start == date(2026, 2, 18)
    assert end == date(2026, 3, 19)


# ── POSITIVE: resolve_event_dates seasonal_range ───────────────

def test_resolve_seasonal_range_same_year():
    """Sharjah Heritage Days Apr → Apr 2026 = Apr 1 to Apr 30."""
    ranges = resolve_event_dates(
        event_type="seasonal_range",
        year=2026,
        seasonal_start_month=4,
        seasonal_end_month=4,
    )
    assert ranges == [(date(2026, 4, 1), date(2026, 4, 30))]


def test_resolve_seasonal_range_wraparound():
    """Riyadh Season Oct → Mar starting in 2026 wraps into 2027.
    End must use 2027's calendar.monthrange (March has 31 days both years)."""
    ranges = resolve_event_dates(
        event_type="seasonal_range",
        year=2026,
        seasonal_start_month=10,
        seasonal_end_month=3,
    )
    assert ranges == [(date(2026, 10, 1), date(2027, 3, 31))]


def test_resolve_seasonal_range_feb_end_uses_leap_year_rule():
    """A Feb-ending season in 2024 (leap year) ends Feb 29; in 2026 (non-leap)
    ends Feb 28. Confirms calendar.monthrange is in play."""
    # 2024 is a leap year; Feb has 29 days.
    leap = resolve_event_dates(
        event_type="seasonal_range",
        year=2024,
        seasonal_start_month=1,
        seasonal_end_month=2,
    )
    assert leap == [(date(2024, 1, 1), date(2024, 2, 29))]
    non_leap = resolve_event_dates(
        event_type="seasonal_range",
        year=2026,
        seasonal_start_month=1,
        seasonal_end_month=2,
    )
    assert non_leap == [(date(2026, 1, 1), date(2026, 2, 28))]


# ── NEGATIVE: primitive validators ─────────────────────────────

@pytest.mark.parametrize("bad_month", [0, 13, -1, 100])
def test_hijri_to_gregorian_rejects_bad_month(bad_month):
    with pytest.raises(ValueError, match="hijri_month"):
        hijri_to_gregorian(1447, bad_month, 1)


@pytest.mark.parametrize("bad_day", [0, 31, -1, 50])
def test_hijri_to_gregorian_rejects_bad_day(bad_day):
    with pytest.raises(ValueError, match="hijri_day"):
        hijri_to_gregorian(1447, 9, bad_day)


@pytest.mark.parametrize("bad_year", [MIN_HIJRI_YEAR - 1, MAX_HIJRI_YEAR + 1, 0, -5])
def test_hijri_to_gregorian_rejects_year_out_of_range(bad_year):
    with pytest.raises(ValueError, match="hijri_year"):
        hijri_to_gregorian(bad_year, 1, 1)


def test_hijri_to_gregorian_rejects_invalid_day_in_29day_month():
    """Day 30 in a Hijri month that's only 29 days in that year must raise.
    Pick (1447, 2, 30) — Safar 1447 is 29 days per UMQ."""
    # If this particular (year, month) happens to be 30 days, the test will
    # fail loudly and we update to a confirmed 29-day month.
    with pytest.raises(ValueError):
        hijri_to_gregorian(1447, 2, 30)


@pytest.mark.parametrize("bad_year", [MIN_GREGORIAN_YEAR - 1, MAX_GREGORIAN_YEAR + 1])
def test_gregorian_to_hijri_rejects_year_out_of_range(bad_year):
    with pytest.raises(ValueError, match="gregorian year"):
        gregorian_to_hijri(date(bad_year, 6, 15))


def test_gregorian_to_hijri_rejects_non_date():
    with pytest.raises(ValueError, match="datetime.date"):
        gregorian_to_hijri("2026-05-16")  # type: ignore[arg-type]


@pytest.mark.parametrize("bad_month", [0, 13])
def test_lunar_event_in_year_rejects_bad_month(bad_month):
    with pytest.raises(ValueError, match="hijri_month"):
        lunar_event_in_gregorian_year(bad_month, 1, 2026)


@pytest.mark.parametrize("bad_day", [0, 31])
def test_lunar_event_in_year_rejects_bad_day(bad_day):
    with pytest.raises(ValueError, match="hijri_day"):
        lunar_event_in_gregorian_year(9, bad_day, 2026)


# ── NEGATIVE: resolve_event_dates validators ───────────────────

def test_resolve_rejects_unknown_event_type():
    with pytest.raises(ValueError, match="event_type"):
        resolve_event_dates(event_type="weekly_recurring", year=2026)


def test_resolve_rejects_zero_duration():
    with pytest.raises(ValueError, match="duration_days"):
        resolve_event_dates(
            event_type="fixed_gregorian",
            year=2026,
            gregorian_month=1,
            gregorian_day=1,
            duration_days=0,
        )


def test_resolve_fixed_requires_both_date_columns():
    with pytest.raises(ValueError, match="fixed_gregorian requires"):
        resolve_event_dates(
            event_type="fixed_gregorian",
            year=2026,
            gregorian_month=9,
            # gregorian_day intentionally missing
        )


def test_resolve_fixed_rejects_bad_day_for_month():
    """Feb 30 must be rejected even though the column itself permits 1..31."""
    with pytest.raises(ValueError, match="gregorian_day"):
        resolve_event_dates(
            event_type="fixed_gregorian",
            year=2026,
            gregorian_month=2,
            gregorian_day=30,
        )


def test_resolve_lunar_requires_both_hijri_columns():
    with pytest.raises(ValueError, match="lunar_hijri requires"):
        resolve_event_dates(
            event_type="lunar_hijri",
            year=2026,
            hijri_month=9,
            # hijri_day intentionally missing
        )


def test_resolve_seasonal_requires_both_month_columns():
    with pytest.raises(ValueError, match="seasonal_range requires"):
        resolve_event_dates(
            event_type="seasonal_range",
            year=2026,
            seasonal_start_month=10,
            # seasonal_end_month intentionally missing
        )


@pytest.mark.parametrize("bad_month", [0, 13, -1])
def test_resolve_seasonal_rejects_bad_start_month(bad_month):
    with pytest.raises(ValueError, match="seasonal_start_month"):
        resolve_event_dates(
            event_type="seasonal_range",
            year=2026,
            seasonal_start_month=bad_month,
            seasonal_end_month=3,
        )


@pytest.mark.parametrize("bad_month", [0, 13, -1])
def test_resolve_seasonal_rejects_bad_end_month(bad_month):
    with pytest.raises(ValueError, match="seasonal_end_month"):
        resolve_event_dates(
            event_type="seasonal_range",
            year=2026,
            seasonal_start_month=4,
            seasonal_end_month=bad_month,
        )


@pytest.mark.parametrize("bad_year", [MIN_GREGORIAN_YEAR - 1, MAX_GREGORIAN_YEAR + 1])
def test_resolve_rejects_year_out_of_range(bad_year):
    with pytest.raises(ValueError, match="year"):
        resolve_event_dates(
            event_type="fixed_gregorian",
            year=bad_year,
            gregorian_month=1,
            gregorian_day=1,
        )
