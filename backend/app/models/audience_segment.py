import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    social_account = relationship("SocialAccount", back_populates="audience_segments")
