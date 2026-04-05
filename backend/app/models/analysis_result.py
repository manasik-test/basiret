import uuid
from sqlalchemy import Column, String, Float, Text, DateTime, ForeignKey, Enum, Index, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class AnalysisResult(Base):
    __tablename__ = "analysis_result"
    __table_args__ = (
        Index("idx_analysis_post", "post_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("post.id", ondelete="CASCADE"), unique=True, nullable=False)
    sentiment = Column(Enum("positive", "neutral", "negative", name="sentiment_label", create_type=False))
    sentiment_score = Column(Float)
    topics = Column(JSONB)
    ocr_text = Column(Text)
    audio_transcript = Column(Text)
    language_detected = Column(Enum("en", "ar", "unknown", name="language_code", create_type=False))
    model_used = Column(String(100))
    analyzed_at = Column(DateTime(timezone=True), server_default=func.now())

    post = relationship("Post", back_populates="analysis_result")
