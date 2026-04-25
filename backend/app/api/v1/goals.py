"""
Goals endpoints — user-defined growth targets, with real-data current values.

GET  /goals          — list active goals for the user's first active account
POST /goals          — create a goal (max 4 per account)
DELETE /goals/{id}   — soft delete (is_active = false)
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.analysis_result import AnalysisResult
from app.models.comment import Comment
from app.models.engagement_metric import EngagementMetric
from app.models.goal import Goal, GoalMetric, GoalPeriod
from app.models.post import Post
from app.models.social_account import SocialAccount
from app.models.user import User

router = APIRouter()

MAX_ACTIVE_GOALS_PER_ACCOUNT = 4


class CreateGoalRequest(BaseModel):
    metric: GoalMetric
    target_value: float = Field(gt=0)
    period: GoalPeriod = GoalPeriod.weekly


def _compute_current_value(
    db: Session, account_id, metric: GoalMetric,
) -> float | None:
    """Compute the current real-data value for a given goal metric.

    Returns None when the metric cannot be computed from available data
    (e.g. follower_growth_pct — Instagram Basic Display API does not expose
    follower counts).
    """
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    post_ids_subq = db.query(Post.id).filter(
        Post.social_account_id == account_id,
    ).subquery()

    if metric == GoalMetric.posts_per_week:
        count = db.query(func.count(Post.id)).filter(
            Post.social_account_id == account_id,
            Post.posted_at >= seven_days_ago,
        ).scalar() or 0
        return float(count)

    if metric == GoalMetric.avg_engagement_rate:
        # (avg_likes + avg_comments) / avg_reach if reach>0, else fallback to likes+comments
        row = (
            db.query(
                func.coalesce(func.avg(EngagementMetric.likes), 0).label("al"),
                func.coalesce(func.avg(EngagementMetric.comments), 0).label("ac"),
                func.coalesce(func.avg(EngagementMetric.reach), 0).label("ar"),
            )
            .join(Post, EngagementMetric.post_id == Post.id)
            .filter(Post.social_account_id == account_id)
            .filter(Post.posted_at >= thirty_days_ago)
            .first()
        )
        if not row:
            return 0.0
        al, ac, ar = float(row.al or 0), float(row.ac or 0), float(row.ar or 0)
        if ar > 0:
            return round(((al + ac) / ar) * 100, 2)
        # Fallback: proxy is (likes+comments) — no percentage; return raw avg eng
        return round(al + ac, 2)

    if metric == GoalMetric.positive_sentiment_pct:
        rows = (
            db.query(
                AnalysisResult.sentiment,
                func.count(AnalysisResult.id).label("n"),
            )
            .join(Comment, AnalysisResult.comment_id == Comment.id)
            .filter(Comment.post_id.in_(db.query(post_ids_subq.c.id)))
            .filter(Comment.created_at >= thirty_days_ago)
            .group_by(AnalysisResult.sentiment)
            .all()
        )
        total = sum(int(r.n) for r in rows)
        if total == 0:
            return 0.0
        positive = sum(int(r.n) for r in rows if r.sentiment == "positive")
        return round(100 * positive / total, 2)

    if metric == GoalMetric.follower_growth_pct:
        # Not available from Instagram Basic Display API
        return None

    return None


def _serialize_goal(db: Session, g: Goal) -> dict:
    current = _compute_current_value(db, g.social_account_id, g.metric)
    return {
        "id": str(g.id),
        "social_account_id": str(g.social_account_id),
        "metric": g.metric.value,
        "target_value": g.target_value,
        "current_value": current,
        "period": g.period.value,
        "is_active": g.is_active,
        "created_at": g.created_at.isoformat() if g.created_at else None,
    }


def _resolve_account(user: User, db: Session) -> SocialAccount | None:
    """Resolve the user's first active social account."""
    return (
        db.query(SocialAccount)
        .filter(
            SocialAccount.organization_id == user.organization_id,
            SocialAccount.is_active == True,  # noqa: E712
        )
        .order_by(SocialAccount.connected_at.asc())
        .first()
    )


@router.get("")
def list_goals(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List active goals for the user's first active social account."""
    account = _resolve_account(user, db)
    if not account:
        return {"success": True, "data": {"goals": []}}

    goals = (
        db.query(Goal)
        .filter(
            Goal.organization_id == user.organization_id,
            Goal.social_account_id == account.id,
            Goal.is_active == True,  # noqa: E712
        )
        .order_by(Goal.created_at.desc())
        .all()
    )

    return {
        "success": True,
        "data": {
            "goals": [_serialize_goal(db, g) for g in goals],
            "social_account_id": str(account.id),
        },
    }


@router.post("")
def create_goal(
    body: CreateGoalRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new goal for the user's first active social account.

    Enforces the max-4-active-goals-per-account cap.
    """
    account = _resolve_account(user, db)
    if not account:
        raise HTTPException(
            status_code=400,
            detail="No active social account. Connect Instagram before setting goals.",
        )

    active_count = (
        db.query(func.count(Goal.id))
        .filter(
            Goal.social_account_id == account.id,
            Goal.is_active == True,  # noqa: E712
        )
        .scalar() or 0
    )
    if active_count >= MAX_ACTIVE_GOALS_PER_ACCOUNT:
        raise HTTPException(
            status_code=400,
            detail=f"Max {MAX_ACTIVE_GOALS_PER_ACCOUNT} active goals per account.",
        )

    goal = Goal(
        organization_id=user.organization_id,
        social_account_id=account.id,
        metric=body.metric,
        target_value=body.target_value,
        period=body.period,
        is_active=True,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)

    return {"success": True, "data": _serialize_goal(db, goal)}


@router.delete("/{goal_id}")
def delete_goal(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete a goal (sets is_active=false).

    Multi-tenant: 404 if the goal belongs to a different org.
    """
    goal = (
        db.query(Goal)
        .filter(
            Goal.id == goal_id,
            Goal.organization_id == user.organization_id,
        )
        .first()
    )
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.is_active = False
    db.commit()
    return {"success": True, "data": None}
