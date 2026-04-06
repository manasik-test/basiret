"""
Analytics endpoints.

GET  /overview             — basic KPI data from the database.
POST /analyze              — trigger NLP analysis for all unanalyzed posts.
GET  /sentiment            — sentiment breakdown across all analyzed posts.
GET  /segments             — audience segments for a social account.
POST /segments/regenerate  — trigger K-means clustering, returns task_id.
"""
import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.post import Post
from app.models.analysis_result import AnalysisResult
from app.models.engagement_metric import EngagementMetric
from app.models.social_account import SocialAccount, Platform
from app.models.audience_segment import AudienceSegment
from app.tasks.nlp_analysis import analyze_posts
from app.tasks.segmentation import segment_audience

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


@router.get("/accounts")
def list_accounts(db: Session = Depends(get_db)):
    """Return active social accounts (needed by frontend to query segments)."""
    accounts = db.query(SocialAccount).filter(SocialAccount.is_active == True).all()
    return {
        "success": True,
        "data": {
            "accounts": [
                {
                    "id": str(a.id),
                    "platform": a.platform.value if a.platform else "instagram",
                    "account_name": a.username,
                }
                for a in accounts
            ],
        },
    }


@router.get("/segments")
def get_segments(social_account_id: str, db: Session = Depends(get_db)):
    """Return audience segments for a social account."""
    segments = (
        db.query(AudienceSegment)
        .filter(AudienceSegment.social_account_id == social_account_id)
        .order_by(AudienceSegment.cluster_id)
        .all()
    )

    return {
        "success": True,
        "data": {
            "social_account_id": social_account_id,
            "segment_count": len(segments),
            "generated_at": str(segments[0].created_at) if segments else None,
            "segments": [
                {
                    "id": str(seg.id),
                    "cluster_id": seg.cluster_id,
                    "label": seg.segment_label,
                    "size": seg.size_estimate,
                    "characteristics": seg.characteristics,
                }
                for seg in segments
            ],
        },
    }


@router.post("/segments/regenerate")
def regenerate_segments(social_account_id: str, db: Session = Depends(get_db)):
    """Queue K-means segmentation for a social account."""
    account = db.query(SocialAccount).filter(
        SocialAccount.id == social_account_id,
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Social account not found")

    task = segment_audience.delay(social_account_id)
    return {
        "success": True,
        "data": {"task_id": task.id, "status": "queued"},
    }
