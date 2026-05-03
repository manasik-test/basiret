"""ScheduledPost — drafts, scheduled posts, and the audit trail of published
posts originating from the Basiret Post Creator.

A single row covers the full lifecycle:
    draft → scheduled → publishing → published
                                  ↘ failed
                                  ↘ cancelled

`media_urls` is JSONB so we can hold a single image, a single video, or a
carousel of up to 10 items in one column. `caption_ar` and `caption_en` are
both stored even when only one is filled — Sprint 1's brand-identity work
made bilingual posting a first-class flow, and a single nullable column
would force the UI to track which language was authored.
"""
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
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


class ScheduledPost(Base):
    __tablename__ = "scheduled_post"
    __table_args__ = (
        Index("idx_scheduled_post_org_status", "organization_id", "status"),
        Index("idx_scheduled_post_account_scheduled", "social_account_id", "scheduled_at"),
        # Cleanup task scans this index nightly.
        Index("idx_scheduled_post_status_expires", "status", "draft_expires_at"),
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
    media_urls = Column(JSONB, nullable=False, default=list, server_default="[]")
    media_type = Column(String(20))
    caption_ar = Column(Text)
    caption_en = Column(Text)
    hashtags = Column(JSONB, nullable=False, default=list, server_default="[]")
    ratio = Column(String(10))
    scheduled_at = Column(DateTime(timezone=True))
    published_at = Column(DateTime(timezone=True))
    status = Column(String(20), nullable=False, default="draft", server_default="draft")
    platform_post_id = Column(String(255))
    ai_generated_media = Column(Boolean, nullable=False, default=False, server_default="false")
    ai_generated_caption = Column(Boolean, nullable=False, default=False, server_default="false")
    source_image_url = Column(Text)
    content_plan_day = Column(Date)
    draft_expires_at = Column(DateTime(timezone=True))
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization")
    social_account = relationship("SocialAccount")
