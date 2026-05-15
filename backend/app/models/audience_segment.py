import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class AudienceSegment(Base):
    __tablename__ = "audience_segment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    social_account_id = Column(UUID(as_uuid=True), ForeignKey("social_account.id", ondelete="CASCADE"), nullable=False)
    segment_label = Column(String(100))
    cluster_id = Column(Integer)
    characteristics = Column(JSONB)
    size_estimate = Column(Integer)
    # Per-language partition added 2026-05-15 (Bug 2 of three-bug fix). One
    # row per (cluster, language) so the EN and AR persona prose can coexist
    # for the same clustering result. Default 'en' matches the historical
    # single-row-per-cluster behavior pre-migration.
    language = Column(String(10), nullable=False, server_default="en")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    social_account = relationship("SocialAccount", back_populates="audience_segments")

    __table_args__ = (
        UniqueConstraint(
            "social_account_id", "cluster_id", "language",
            name="uq_audience_segment_account_cluster_lang",
        ),
        Index("idx_audience_segment_account_lang", "social_account_id", "language"),
    )
