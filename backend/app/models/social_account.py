import uuid
import enum
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Enum, Index, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Platform(str, enum.Enum):
    instagram = "instagram"


class SocialAccount(Base):
    __tablename__ = "social_account"
    __table_args__ = (
        UniqueConstraint("organization_id", "platform", "platform_account_id"),
        Index("idx_social_account_org", "organization_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organization.id", ondelete="CASCADE"), nullable=False)
    platform = Column(Enum(Platform, name="platform", create_type=False), nullable=False, default=Platform.instagram)
    platform_account_id = Column(String(255), nullable=False)
    username = Column(String(255))
    access_token_encrypted = Column(Text)
    token_expires_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    connected_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="social_accounts")
    posts = relationship("Post", back_populates="social_account", cascade="all, delete-orphan")
    audience_segments = relationship("AudienceSegment", back_populates="social_account", cascade="all, delete-orphan")
