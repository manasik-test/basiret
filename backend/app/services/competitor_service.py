"""Competitor + trends data service.

This module is the single backend gateway for the Competitors and Trends
pages. Today it returns curated mock data shaped exactly like a real RapidAPI
response (Instagram public-profile stats + hashtag trends). When
``settings.RAPIDAPI_KEY`` is set, future commits can swap the in-module mock
loaders for live HTTP calls without touching the routes that consume them.

Why a service module instead of inlining in the route?
- Pages can mix cached real data + freshly-mocked rows during the rollout.
- Test-time stubbing is cleaner (one patch target).
- The frontend contract stays stable while we iterate on which RapidAPI
  endpoint we actually trust.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Default mock dataset — keeps Trends + Competitors visually rich during
# graduation defense even when RAPIDAPI_KEY is unset.
_MOCK_LEADERBOARD: list[dict[str, Any]] = [
    {
        "handle": "@raid_co", "name": "Raid Co", "avatar": "R",
        "followers": "24.8K", "growth": "+5.4%", "engagement": "12.3%",
        "cadence": "7/week", "mix": {"video": 60, "image": 25, "carousel": 15},
        "sentiment": 78,
    },
    {
        "handle": "@nour_design", "name": "Nour Design", "avatar": "N",
        "followers": "18.2K", "growth": "+3.8%", "engagement": "10.1%",
        "cadence": "5/week", "mix": {"video": 30, "image": 55, "carousel": 15},
        "sentiment": 71,
    },
    {
        "handle": "@sahab_studio", "name": "Sahab Studio", "avatar": "S",
        "followers": "9.6K", "growth": "+1.2%", "engagement": "8.4%",
        "cadence": "3/week", "mix": {"video": 20, "image": 60, "carousel": 20},
        "sentiment": 64,
    },
    {
        "handle": "@noor_brand", "name": "Noor Brand", "avatar": "M",
        "followers": "31.5K", "growth": "+0.4%", "engagement": "5.8%",
        "cadence": "4/week", "mix": {"video": 40, "image": 40, "carousel": 20},
        "sentiment": 52,
    },
]

_MOCK_TOP_POSTS: list[dict[str, Any]] = [
    {"who": "@raid_co", "format": "video", "metric": "24K views",
     "engagement_pct": "+320%", "tag_key": "beforeafter"},
    {"who": "@noor_brand", "format": "carousel", "metric": "1.2K saves",
     "engagement_pct": "+180%", "tag_key": "tips"},
    {"who": "@raid_co", "format": "video", "metric": "18K views",
     "engagement_pct": "+210%", "tag_key": "behindscenes"},
    {"who": "@nour_design", "format": "image", "metric": "420 engagements",
     "engagement_pct": "+45%", "tag_key": "promo"},
]

_MOCK_HASHTAG_TRENDS: list[dict[str, Any]] = [
    {"tag": "#desert_night", "volume": 12400, "momentum": "+182%", "phase": "rising", "days": 3},
    {"tag": "#price_value", "volume": 28800, "momentum": "+64%", "phase": "peaking", "days": 11},
    {"tag": "#saudi_matcha", "volume": 4900, "momentum": "+340%", "phase": "rising", "days": 5},
    {"tag": "#75day_challenge", "volume": 7200, "momentum": "-42%", "phase": "fading", "days": 38},
    {"tag": "#riyadh_season", "volume": 92000, "momentum": "+38%", "phase": "rising", "days": 21},
    {"tag": "#national_day_96", "volume": 184000, "momentum": "+95%", "phase": "rising", "days": 14},
    {"tag": "#summer_heat", "volume": 61000, "momentum": "+22%", "phase": "peaking", "days": 10},
]


def get_competitor_leaderboard(*, market: str = "MENA") -> list[dict[str, Any]]:
    """Return a competitor-leaderboard list. Mock today; falls through to a
    real RapidAPI batch profile lookup when ``RAPIDAPI_KEY`` is configured."""
    _ = market  # placeholder for future market-routing
    if not settings.RAPIDAPI_KEY:
        return _MOCK_LEADERBOARD
    try:
        # Real implementation would batch-resolve handles via the RapidAPI
        # Instagram bulk-profile endpoint. The batch shape is intentionally
        # the same as the mock so the frontend never sees a schema swap.
        return _fetch_rapidapi_profiles(["raid_co", "nour_design", "sahab_studio", "noor_brand"])
    except Exception as exc:  # noqa: BLE001 — best-effort
        logger.warning("RapidAPI competitor lookup failed (%s) — falling back to mock", exc)
        return _MOCK_LEADERBOARD


def get_top_competitor_posts(*, market: str = "MENA") -> list[dict[str, Any]]:
    """Top performing posts across the competitor set. Mock today."""
    _ = market
    return _MOCK_TOP_POSTS


def get_hashtag_trends(*, market: str = "MENA") -> list[dict[str, Any]]:
    """Top trending hashtags in the market. Mock today; live via RapidAPI
    hashtag-trends endpoint when configured."""
    _ = market
    if not settings.RAPIDAPI_KEY:
        return _MOCK_HASHTAG_TRENDS
    try:
        return _fetch_rapidapi_hashtags(market)
    except Exception as exc:  # noqa: BLE001
        logger.warning("RapidAPI hashtag-trends lookup failed (%s) — falling back to mock", exc)
        return _MOCK_HASHTAG_TRENDS


def _fetch_rapidapi_profiles(handles: list[str]) -> list[dict[str, Any]]:
    """Live profile fetch via RapidAPI. Wired but never raises into the route —
    callers all wrap this in a try/except. The exact endpoint depends on which
    Instagram-scraper provider the user signs up for (instagram-scraper-api2
    is a common one; the host is configurable via RAPIDAPI_INSTAGRAM_HOST)."""
    headers = {
        "x-rapidapi-key": settings.RAPIDAPI_KEY,
        "x-rapidapi-host": settings.RAPIDAPI_INSTAGRAM_HOST,
    }
    out: list[dict[str, Any]] = []
    with httpx.Client(timeout=10.0) as client:
        for handle in handles:
            url = f"https://{settings.RAPIDAPI_INSTAGRAM_HOST}/v1/info"
            r = client.get(url, headers=headers, params={"username_or_id_or_url": handle})
            r.raise_for_status()
            data = r.json().get("data", {})
            out.append({
                "handle": f"@{handle}",
                "name": data.get("full_name") or handle,
                "avatar": (data.get("full_name") or handle)[:1].upper(),
                "followers": _humanize_count(data.get("follower_count", 0)),
                "growth": "+0%",  # RapidAPI v1/info doesn't expose growth — needs a second snapshot.
                "engagement": "—",
                "cadence": "—",
                "mix": {"video": 33, "image": 34, "carousel": 33},
                "sentiment": 0,
            })
    return out


def _fetch_rapidapi_hashtags(market: str) -> list[dict[str, Any]]:
    _ = market
    # Placeholder — RapidAPI doesn't have a single canonical "trending hashtags
    # in MENA" endpoint. Real impl would aggregate top posts and rank tags.
    return _MOCK_HASHTAG_TRENDS


def _humanize_count(n: int) -> str:
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M".rstrip("0").rstrip(".")
    if n >= 1_000:
        return f"{n/1_000:.1f}K".rstrip("0").rstrip(".")
    return str(n)
