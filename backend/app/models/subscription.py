import uuid
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class PlanTier(str, enum.Enum):
    starter = "starter"
    insights = "insights"
    enterprise = "enterprise"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    cancelled = "cancelled"
    past_due = "past_due"
    trialing = "trialing"


class Subscription(Base):
    __tablename__ = "subscription"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organization.id", ondelete="CASCADE"), unique=True, nullable=False)
    plan_tier = Column(Enum(PlanTier, name="plan_tier", create_type=False), nullable=False, default=PlanTier.starter)
    status = Column(Enum(SubscriptionStatus, name="subscription_status", create_type=False), nullable=False, default=SubscriptionStatus.active)
    stripe_customer_id = Column(String(255))
    stripe_subscription_id = Column(String(255))
    current_period_start = Column(DateTime(timezone=True))
    current_period_end = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="subscription")
