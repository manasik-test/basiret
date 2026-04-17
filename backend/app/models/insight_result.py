import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class InsightResult(Base):
    __tablename__ = "insight_result"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    social_account_id = Column(UUID(as_uuid=True), ForeignKey("social_account.id", ondelete="CASCADE"), nullable=False)
    week_start = Column(DateTime(timezone=True), nullable=False)
    summary = Column(String(500))
    score = Column(Float)
    score_change = Column(Float)
    insights = Column(JSONB)
    best_post_id = Column(UUID(as_uuid=True), ForeignKey("post.id", ondelete="SET NULL"), nullable=True)
    next_best_time = Column(String(100))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    social_account = relationship("SocialAccount")
    best_post = relationship("Post")
