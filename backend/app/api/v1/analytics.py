"""
Analytics endpoints.

GET /overview — basic KPI data from the database.
POST /analyze — trigger NLP analysis for all unanalyzed posts.
GET /sentiment — sentiment breakdown across all analyzed posts.
"""
import sqlalchemy
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.post import Post
from app.models.analysis_result import AnalysisResult
from app.models.engagement_metric import EngagementMetric
from app.models.social_account import SocialAccount, Platform
from app.tasks.nlp_analysis import analyze_posts

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


@router.post("/analyze")
def trigger_analysis():
    """Queue NLP analysis for all unanalyzed posts."""
    task = analyze_posts.delay()
    return {
        "success": True,
        "data": {"task_id": task.id, "status": "queued"},
    }


@router.get("/sentiment")
def sentiment_overview(db: Session = Depends(get_db)):
    """Return sentiment distribution across all analyzed posts."""
    total_analyzed = db.query(func.count(AnalysisResult.id)).scalar() or 0

    breakdown = (
        db.query(
            AnalysisResult.sentiment,
            func.count(AnalysisResult.id).label("count"),
            func.round(func.avg(AnalysisResult.sentiment_score).cast(sqlalchemy.Numeric), 4).label("avg_score"),
        )
        .group_by(AnalysisResult.sentiment)
        .all()
    )

    sentiment_data = {
        row.sentiment: {"count": row.count, "avg_score": float(row.avg_score or 0)}
        for row in breakdown
    }

    # Count posts still awaiting analysis
    total_posts = db.query(func.count(Post.id)).scalar() or 0
    pending = total_posts - total_analyzed

    return {
        "success": True,
        "data": {
            "total_analyzed": total_analyzed,
            "pending_analysis": pending,
            "sentiment": sentiment_data,
        },
    }
