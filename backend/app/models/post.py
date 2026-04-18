import uuid
import enum
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum, Index, UniqueConstraint, text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class ContentType(str, enum.Enum):
    image = "image"
    video = "video"
    reel = "reel"
    story = "story"
    carousel = "carousel"
    text = "text"


class LanguageCode(str, enum.Enum):
    en = "en"
    ar = "ar"
    unknown = "unknown"


class Post(Base):
    __tablename__ = "post"
    __table_args__ = (
        UniqueConstraint("platform", "platform_post_id"),
        Index("idx_post_social_account", "social_account_id"),
        Index("idx_post_posted_at", text("posted_at DESC")),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    social_account_id = Column(UUID(as_uuid=True), ForeignKey("social_account.id", ondelete="CASCADE"), nullable=False)
    platform_post_id = Column(String(255), nullable=False)
    platform = Column(Enum("instagram", name="platform", create_type=False), nullable=False, default="instagram")
    content_type = Column(Enum(ContentType, name="content_type", create_type=False))
    language = Column(Enum(LanguageCode, name="language_code", create_type=False), default=LanguageCode.unknown)
    caption = Column(Text)
    media_url = Column(Text)
    posted_at = Column(DateTime(timezone=True))
    raw_data = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    social_account = relationship("SocialAccount", back_populates="posts")
    analysis_result = relationship("AnalysisResult", back_populates="post", uselist=False, cascade="all, delete-orphan")
    engagement_metrics = relationship("EngagementMetric", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
