import uuid
import enum
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum, Index, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserRole(str, enum.Enum):
    system_admin = "system_admin"
    admin = "admin"
    manager = "manager"
    viewer = "viewer"


class User(Base):
    __tablename__ = "user"
    __table_args__ = (
        Index("idx_user_org", "organization_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organization.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255))
    full_name = Column(String(255))
    role = Column(Enum(UserRole, name="user_role", create_type=False), nullable=False, default=UserRole.viewer)
    is_active = Column(Boolean, default=True)
    # "Generate all 7 posts" remember-my-choice preference. NULL action means
    # the dialog opens fresh each time. When both fields are set (remember=true
    # AND action in {drafts, schedule}) the frontend skips the dialog and goes
    # straight to a batch generation with the saved action.
    batch_generate_default_action = Column(String(20), nullable=True)
    batch_generate_remember = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="users")
