import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class GoalMetric(str, enum.Enum):
    avg_engagement_rate = "avg_engagement_rate"
    posts_per_week = "posts_per_week"
    positive_sentiment_pct = "positive_sentiment_pct"
    follower_growth_pct = "follower_growth_pct"


class GoalPeriod(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"


class Goal(Base):
    """User-defined Instagram growth target.

    One row per active target. Soft-deleted via `is_active=False` so
    historical goals can be revisited. Max 4 active goals per
    social_account enforced at the API layer.
    """

    __tablename__ = "goal"
    __table_args__ = (
        Index("idx_goal_org_active", "organization_id", "is_active"),
        Index("idx_goal_account_active", "social_account_id", "is_active"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organization.id", ondelete="CASCADE"),
        nullable=False,
    )
    social_account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("social_account.id", ondelete="CASCADE"),
        nullable=False,
    )
    metric = Column(
        Enum(GoalMetric, name="goal_metric", create_type=False),
        nullable=False,
    )
    target_value = Column(Float, nullable=False)
    period = Column(
        Enum(GoalPeriod, name="goal_period", create_type=False),
        nullable=False,
        default=GoalPeriod.weekly,
    )
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
