"""Hijri ↔ Gregorian conversion + cultural_event date resolution.

Built on the `hijridate` package, which implements the official **Umm al-Qura
calendar** — the civil Hijri calendar of Saudi Arabia (and the most aligned
with GCC official observance). UMQ is calculation-based, so dates are stable
years in advance.

Important caveat: UMQ may differ by ±1 day from the **sighting-based** start
of Ramadan / Eid announced by Saudi Arabia's Supreme Court (or other GCC
states' religious authorities). For Content Plan purposes this is acceptable
— we surface events with a `lead_time_days` buffer so a one-day shift in the
official announcement does not invalidate planning content. For any flow
that depends on the official observance date (e.g. an Eid greeting that must
publish on the exact day), consume the official announcement at runtime
rather than relying on this utility.

Supported range: 1 Muharram 1343 AH (1924-08-01) to ~1500 AH (2077-11-16).
Outside this range, `hijridate` itself raises ``ValueError``; we layer
explicit bounds checks at the public API so callers get clean errors.
"""
from __future__ import annotations

import calendar
from datetime import date

from hijridate import Gregorian, Hijri


# Bounds advertised by `hijridate`'s UMQ tables. Hard-coded here so the
# public API validates input before delegating, giving us a single, stable
# error message instead of relying on the library's wording.
MIN_HIJRI_YEAR = 1343
MAX_HIJRI_YEAR = 1500
MIN_GREGORIAN_YEAR = 1924
MAX_GREGORIAN_YEAR = 2077

VALID_EVENT_TYPES = frozenset({"fixed_gregorian", "lunar_hijri", "seasonal_range"})


# ── Primitive conversions ──────────────────────────────────────

def hijri_to_gregorian(hy: int, hm: int, hd: int) -> date:
    """Convert a Hijri (year, month, day) tuple to a Gregorian ``date``.

    Raises ``ValueError`` for out-of-range inputs (including hy outside the
    UMQ table range, hm outside 1..12, hd outside 1..30, OR a valid month/day
    combination that doesn't exist in the requested Hijri year — e.g. day 30
    of a 29-day month).
    """
    if not isinstance(hy, int) or not isinstance(hm, int) or not isinstance(hd, int):
        raise ValueError("hijri_to_gregorian requires int year/month/day")
    if not (1 <= hm <= 12):
        raise ValueError(f"hijri_month must be 1..12, got {hm}")
    if not (1 <= hd <= 30):
        raise ValueError(f"hijri_day must be 1..30, got {hd}")
    if not (MIN_HIJRI_YEAR <= hy <= MAX_HIJRI_YEAR):
        raise ValueError(
            f"hijri_year must be {MIN_HIJRI_YEAR}..{MAX_HIJRI_YEAR}, got {hy}"
        )
    g = Hijri(hy, hm, hd).to_gregorian()
    return date(g.year, g.month, g.day)


def gregorian_to_hijri(g: date) -> tuple[int, int, int]:
    """Convert a Gregorian ``date`` to (hijri_year, hijri_month, hijri_day)."""
    if not isinstance(g, date):
        raise ValueError("gregorian_to_hijri requires a datetime.date")
    if not (MIN_GREGORIAN_YEAR <= g.year <= MAX_GREGORIAN_YEAR):
        raise ValueError(
            f"gregorian year must be {MIN_GREGORIAN_YEAR}..{MAX_GREGORIAN_YEAR}, "
            f"got {g.year}"
        )
    h = Gregorian(g.year, g.month, g.day).to_hijri()
    return (h.year, h.month, h.day)


def lunar_event_in_gregorian_year(hm: int, hd: int, year: int) -> list[date]:
    """Return every Gregorian ``date`` in ``year`` where Hijri (hm, hd) falls.

    Most Hijri events fall once per Gregorian year. Near year boundaries a
    lunar event can occur 0 or 2 times in a single Gregorian year (because
    Hijri is ~354 days). Returned list is sorted ascending.

    Silently skips Hijri years where (hm, hd) is invalid (e.g. day 30 in a
    29-day month) — those simply don't contribute an occurrence that year.
    Re-raises any other ``hijridate`` error.
    """
    if not (1 <= hm <= 12):
        raise ValueError(f"hijri_month must be 1..12, got {hm}")
    if not (1 <= hd <= 30):
        raise ValueError(f"hijri_day must be 1..30, got {hd}")
    if not (MIN_GREGORIAN_YEAR <= year <= MAX_GREGORIAN_YEAR):
        raise ValueError(
            f"year must be {MIN_GREGORIAN_YEAR}..{MAX_GREGORIAN_YEAR}, got {year}"
        )

    hy_start, _, _ = gregorian_to_hijri(date(year, 1, 1))
    hy_end, _, _ = gregorian_to_hijri(date(year, 12, 31))

    results: list[date] = []
    for hy in range(hy_start, hy_end + 1):
        try:
            g = hijri_to_gregorian(hy, hm, hd)
        except ValueError:
            # Day-out-of-range for this specific Hijri month — skip silently.
            continue
        if g.year == year:
            results.append(g)
    return sorted(results)


# ── Event-date resolution ──────────────────────────────────────

def resolve_event_dates(
    *,
    event_type: str,
    year: int,
    gregorian_month: int | None = None,
    gregorian_day: int | None = None,
    hijri_month: int | None = None,
    hijri_day: int | None = None,
    seasonal_start_month: int | None = None,
    seasonal_end_month: int | None = None,
    duration_days: int = 1,
) -> list[tuple[date, date]]:
    """Resolve a ``cultural_event`` row to its (start, end) Gregorian ranges
    in the given target Gregorian ``year``.

    Returns 0+ ``(start, end)`` tuples (inclusive on both ends):

    - ``fixed_gregorian``: always exactly one range.
    - ``lunar_hijri``: 0, 1, or 2 ranges depending on how the Hijri year
      boundary aligns with ``year``.
    - ``seasonal_range``: one range. If ``end_month < start_month`` the range
      wraps into ``year + 1`` (e.g. Riyadh Season Oct–Mar → Oct 1 to Mar 31).

    TODO: lunar events that wrap a Hijri month boundary use ``duration_days``
    directly, which can be off by ±1 day vs. the actual Hijri month length
    (e.g. Ramadan is 29 or 30 days depending on the year). Acceptable for
    Content Plan surfacing; revisit if a downstream feature needs exact
    month-end alignment.
    """
    if event_type not in VALID_EVENT_TYPES:
        raise ValueError(
            f"event_type must be one of {sorted(VALID_EVENT_TYPES)}, got {event_type!r}"
        )
    if duration_days < 1:
        raise ValueError(f"duration_days must be >= 1, got {duration_days}")
    if not (MIN_GREGORIAN_YEAR <= year <= MAX_GREGORIAN_YEAR):
        raise ValueError(
            f"year must be {MIN_GREGORIAN_YEAR}..{MAX_GREGORIAN_YEAR}, got {year}"
        )

    if event_type == "fixed_gregorian":
        if gregorian_month is None or gregorian_day is None:
            raise ValueError(
                "fixed_gregorian requires gregorian_month and gregorian_day"
            )
        if not (1 <= gregorian_month <= 12):
            raise ValueError(f"gregorian_month must be 1..12, got {gregorian_month}")
        max_day = calendar.monthrange(year, gregorian_month)[1]
        if not (1 <= gregorian_day <= max_day):
            raise ValueError(
                f"gregorian_day {gregorian_day} invalid for {year}-{gregorian_month:02d} "
                f"(max {max_day})"
            )
        start = date(year, gregorian_month, gregorian_day)
        end = date.fromordinal(start.toordinal() + duration_days - 1)
        return [(start, end)]

    if event_type == "lunar_hijri":
        if hijri_month is None or hijri_day is None:
            raise ValueError("lunar_hijri requires hijri_month and hijri_day")
        ranges: list[tuple[date, date]] = []
        for start in lunar_event_in_gregorian_year(hijri_month, hijri_day, year):
            end = date.fromordinal(start.toordinal() + duration_days - 1)
            ranges.append((start, end))
        return ranges

    # event_type == "seasonal_range"
    if seasonal_start_month is None or seasonal_end_month is None:
        raise ValueError(
            "seasonal_range requires seasonal_start_month and seasonal_end_month"
        )
    if not (1 <= seasonal_start_month <= 12):
        raise ValueError(
            f"seasonal_start_month must be 1..12, got {seasonal_start_month}"
        )
    if not (1 <= seasonal_end_month <= 12):
        raise ValueError(
            f"seasonal_end_month must be 1..12, got {seasonal_end_month}"
        )
    start = date(year, seasonal_start_month, 1)
    if seasonal_start_month <= seasonal_end_month:
        end_year = year
    else:
        # Wraparound (e.g. Oct → Mar): the season started in `year` and
        # rolls into the next calendar year.
        end_year = year + 1
    last_day = calendar.monthrange(end_year, seasonal_end_month)[1]
    end = date(end_year, seasonal_end_month, last_day)
    return [(start, end)]
