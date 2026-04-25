import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class FeedbackKind(str, enum.Enum):
    helpful = "helpful"
    not_helpful = "not_helpful"


class RecommendationFeedback(Base):
    """One thumbs-up/down per (account, recommendation_text).

    Upsert semantics: if the user flips their vote, the existing row is
    updated in place (via the UNIQUE(social_account_id, recommendation_text)
    constraint). Private — no aggregate counts are exposed.
    """

    __tablename__ = "recommendation_feedback"
    __table_args__ = (
        UniqueConstraint(
            "social_account_id", "recommendation_text",
            name="uq_rec_feedback_account_text",
        ),
        Index("idx_rec_feedback_org", "organization_id"),
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
    insight_result_id = Column(
        UUID(as_uuid=True),
        ForeignKey("insight_result.id", ondelete="SET NULL"),
        nullable=True,
    )
    recommendation_text = Column(Text, nullable=False)
    feedback = Column(
        Enum(FeedbackKind, name="feedback_kind", create_type=False),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
