"""
Analytics endpoints.

GET /overview — basic KPI data from the database.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.post import Post
from app.models.engagement_metric import EngagementMetric
from app.models.social_account import SocialAccount, Platform

router = APIRouter()


@router.get("/overview")
def analytics_overview(db: Session = Depends(get_db)):
    """Return top-level KPI summary across all posts."""

    total_posts = db.query(func.count(Post.id)).scalar() or 0

    metrics = db.query(
        func.coalesce(func.sum(EngagementMetric.likes), 0).label("total_likes"),
        func.coalesce(func.sum(EngagementMetric.comments), 0).label("total_comments"),
        func.coalesce(func.sum(EngagementMetric.shares), 0).label("total_shares"),
        func.coalesce(func.sum(EngagementMetric.saves), 0).label("total_saves"),
        func.coalesce(func.sum(EngagementMetric.reach), 0).label("total_reach"),
        func.coalesce(func.sum(EngagementMetric.impressions), 0).label("total_impressions"),
    ).first()

    total_engagement = metrics.total_likes + metrics.total_comments + metrics.total_shares + metrics.total_saves
    avg_engagement = round(total_engagement / total_posts, 2) if total_posts > 0 else 0.0

    connected_accounts = db.query(func.count(SocialAccount.id)).filter(
        SocialAccount.is_active == True,
    ).scalar() or 0

    return {
        "success": True,
        "data": {
            "total_posts": total_posts,
            "total_likes": metrics.total_likes,
            "total_comments": metrics.total_comments,
            "total_shares": metrics.total_shares,
            "total_saves": metrics.total_saves,
            "total_reach": metrics.total_reach,
            "total_impressions": metrics.total_impressions,
            "total_engagement": total_engagement,
            "avg_engagement_per_post": avg_engagement,
            "connected_accounts": connected_accounts,
        },
    }
