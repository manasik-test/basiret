"""Market intelligence routes — Competitors and Trends pages.

These endpoints sit behind the ``content_recommendations`` feature flag (Pro
tier) and are powered by ``app.services.competitor_service`` which today
returns mock data shaped like a real RapidAPI response. When ``RAPIDAPI_KEY``
is set in the environment, the same routes start returning live data.
"""
from fastapi import APIRouter, Depends

from app.core.deps import RequireFeature
from app.models.user import User
from app.services.competitor_service import (
    get_competitor_leaderboard,
    get_top_competitor_posts,
    get_hashtag_trends,
)

router = APIRouter()


@router.get("/competitors/leaderboard")
def competitors_leaderboard(
    user: User = Depends(RequireFeature("content_recommendations")),
):
    """Leaderboard of competitor accounts: followers / growth / engagement /
    cadence / mix / sentiment."""
    _ = user  # auth-only; data is org-agnostic for now
    return {
        "success": True,
        "data": {"competitors": get_competitor_leaderboard()},
    }


@router.get("/competitors/top-posts")
def competitors_top_posts(
    user: User = Depends(RequireFeature("content_recommendations")),
):
    """Top performing posts across the competitor set."""
    _ = user
    return {
        "success": True,
        "data": {"posts": get_top_competitor_posts()},
    }


@router.get("/trends/hashtags")
def trends_hashtags(
    user: User = Depends(RequireFeature("content_recommendations")),
):
    """Trending hashtags in the user's market (default MENA)."""
    _ = user
    return {
        "success": True,
        "data": {"hashtags": get_hashtag_trends()},
    }
