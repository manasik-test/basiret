import enum
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Index,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

from app.core.database import Base


class EventType(str, enum.Enum):
    """Drives which date columns are populated and how the event resolves to
    a Gregorian date at query time (Phase 1B utility consumes this)."""

    fixed_gregorian = "fixed_gregorian"
    lunar_hijri = "lunar_hijri"
    seasonal_range = "seasonal_range"


class SourceConfidence(str, enum.Enum):
    verified = "verified"
    secondary = "secondary"
    inferred = "inferred"


class CulturalEvent(Base):
    """GCC cultural / religious / seasonal event catalogued for the Content
    Plan's cultural-fluency surface.

    Schema notes:
      - ``country_iso`` is NULL for cross-GCC / shared entries (Ramadan, Eid,
        regional commercial moments like Black/White Friday).
      - Lunar events store (hijri_month, hijri_day) and are converted to the
        current Gregorian year at query time by the Phase 1B utility, so the
        table needs no annual maintenance.
      - ``content_guidelines`` and ``audience_behavior`` are JSONB with a
        documented shape (see Phase 1C spec in the session prompt). They're
        free-form by design so the Phase 1C seed can iterate without DDL
        churn during user review.
      - CHECK constraints in the migration enforce per-type date population,
        the 1..10 significance range, and the GCC ISO whitelist. Per-type
        date constraints carry explicit IS NOT NULL guards because Postgres
        treats NULL CHECK results as passing — without the guards, a
        ``fixed_gregorian`` row with both date columns NULL would slip
        through (NULL BETWEEN 1 AND 12 → NULL, NULL OR FALSE → NULL → pass).
    """

    __tablename__ = "cultural_event"
    __table_args__ = (
        # Mirror the migration's CHECK constraints so SQLAlchemy's metadata
        # round-trip (used by some tests and tooling) sees them too.
        CheckConstraint(
            "event_type IN ('fixed_gregorian','lunar_hijri','seasonal_range')",
            name="cultural_event_type_chk",
        ),
        CheckConstraint(
            "source_confidence IN ('verified','secondary','inferred')",
            name="cultural_event_source_conf_chk",
        ),
        CheckConstraint(
            "country_iso IS NULL OR country_iso IN ('SA','AE','QA','KW','OM','BH')",
            name="cultural_event_country_chk",
        ),
        CheckConstraint(
            "cultural_significance BETWEEN 1 AND 10",
            name="cultural_event_significance_chk",
        ),
        CheckConstraint(
            "duration_days >= 1",
            name="cultural_event_duration_chk",
        ),
        CheckConstraint(
            "lead_time_days >= 0",
            name="cultural_event_lead_time_chk",
        ),
        Index(
            "idx_cultural_event_country_significance",
            "country_iso", "cultural_significance",
        ),
        Index("idx_cultural_event_type", "event_type"),
        Index("idx_cultural_event_updated", "updated_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_key = Column(String(64), nullable=False, unique=True)
    name_en = Column(String(128), nullable=False)
    name_ar = Column(String(128), nullable=False)
    country_iso = Column(String(2), nullable=True)
    event_type = Column(String(20), nullable=False)

    gregorian_month = Column(SmallInteger, nullable=True)
    gregorian_day = Column(SmallInteger, nullable=True)
    hijri_month = Column(SmallInteger, nullable=True)
    hijri_day = Column(SmallInteger, nullable=True)
    duration_days = Column(SmallInteger, nullable=False, default=1)
    seasonal_start_month = Column(SmallInteger, nullable=True)
    seasonal_end_month = Column(SmallInteger, nullable=True)

    cultural_significance = Column(SmallInteger, nullable=False)
    lead_time_days = Column(SmallInteger, nullable=False, default=7)

    industries_high_relevance = Column(
        ARRAY(Text), nullable=False, default=list,
    )
    content_guidelines = Column(JSONB, nullable=False)
    audience_behavior = Column(JSONB, nullable=False)
    year_specific_notes = Column(JSONB, nullable=True)

    source_url = Column(String(512), nullable=True)
    source_confidence = Column(String(20), nullable=False, default="secondary")
    last_verified = Column(Date, nullable=False)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False, server_default=func.now(), onupdate=func.now(),
    )
