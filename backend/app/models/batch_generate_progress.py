"""BatchGenerateProgress — tracks an in-flight "Generate all 7 posts" run.

The Celery task writes per-day progress into `per_day_status` (JSONB) as each
day completes; the frontend polls a single REST endpoint every ~4s and renders
each day's image/caption/post sub-status from one row. One row per batch run;
older rows stay around as an audit trail (no cleanup task — the table is
expected to stay small at graduation scale).

per_day_status shape — keyed by day_index string:
    {
        "0": {
            "status": "queued|generating_image|generating_caption|saving|done|failed",
            "scheduled_post_id": "uuid-or-null",
            "error": "human-readable string when status='failed', else null",
            "fell_back_to_draft": false  # true when 'schedule' action couldn't honor scheduled_at
        },
        ...
    }
"""
import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class BatchGenerateProgress(Base):
    __tablename__ = "batch_generate_progress"
    __table_args__ = (
        Index(
            "idx_batch_progress_account_lang_status",
            "social_account_id",
            "language",
            "status",
        ),
        Index("idx_batch_progress_org", "organization_id"),
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
    # SET NULL on user delete: the audit trail of "what was generated" stays
    # even if the user who kicked it off later removes their account.
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
    )
    language = Column(String(8), nullable=False)
    action = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="running", server_default="running")
    per_day_status = Column(JSONB, nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)

    organization = relationship("Organization")
    social_account = relationship("SocialAccount")
