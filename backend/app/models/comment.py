import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Comment(Base):
    __tablename__ = "comment"
    __table_args__ = (
        UniqueConstraint("platform_comment_id"),
        Index("idx_comment_post", "post_id"),
        Index("idx_comment_created", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("post.id", ondelete="CASCADE"), nullable=False)
    platform_comment_id = Column(String(255), nullable=False)
    text = Column(Text)
    author_username = Column(String(255))
    created_at = Column(DateTime(timezone=True))
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())

    post = relationship("Post", back_populates="comments")
    analysis_result = relationship(
        "AnalysisResult",
        back_populates="comment",
        uselist=False,
        cascade="all, delete-orphan",
    )
