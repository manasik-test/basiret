import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class AiUsageLog(Base):
    """One row per successful AI provider call.

    Used by the rate-limit gate (count of rows in the past 24h per
    account+provider) and by the /admin/ai-usage admin dashboard (7-day
    aggregate per account).

    Notes:
      - `social_account_id` is nullable so test/system calls without an
        account context can still be logged (they bypass the rate-limit gate
        anyway since gating short-circuits when the id is None).
      - `source` distinguishes user-triggered ("user") from background SWR
        refreshes ("background"). Background calls bypass the rate-limit gate
        but ARE logged so admin visibility remains accurate.
      - `tokens_used` is best-effort — Gemini exposes
        `usage_metadata.total_token_count` and OpenAI exposes
        `usage.total_tokens`; some response shapes lack it (left NULL).
    """

    __tablename__ = "ai_usage_log"
    __table_args__ = (
        Index("idx_ai_usage_account_called", "social_account_id", "called_at"),
        Index("idx_ai_usage_provider_called", "provider", "called_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    social_account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("social_account.id", ondelete="CASCADE"),
        nullable=True,
    )
    provider = Column(String(20), nullable=False)
    task = Column(String(20), nullable=False)
    source = Column(String(20), nullable=False, default="user")
    tokens_used = Column(Integer, nullable=True)
    called_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
