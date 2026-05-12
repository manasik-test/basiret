import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class AiPageCache(Base):
    __tablename__ = "ai_page_cache"
    __table_args__ = (
        UniqueConstraint("social_account_id", "page_name", "language", name="uq_ai_page_cache_key"),
        Index("idx_ai_page_cache_lookup", "social_account_id", "page_name", "language"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    social_account_id = Column(UUID(as_uuid=True), ForeignKey("social_account.id", ondelete="CASCADE"), nullable=False)
    page_name = Column(String(64), nullable=False)
    language = Column(String(8), nullable=False, default="en")
    content = Column(JSONB, nullable=False)
    generated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # Set when a user manually overwrites a cached value (e.g. Content Plan
    # "Update the suggestion"). Does NOT extend TTL — generated_at still
    # gates freshness, so a user edit persists only until the next
    # AI regeneration overwrites the row.
    last_user_edit_at = Column(DateTime(timezone=True), nullable=True)
