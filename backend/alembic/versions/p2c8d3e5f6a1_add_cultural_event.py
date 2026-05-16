"""add cultural_event table

Revision ID: p2c8d3e5f6a1
Revises: o1b7c2d3e4f5
Create Date: 2026-05-16 10:00:00.000000

Week 2 Phase 1A — GCC cultural calendar foundation.

Single table holding fixed-gregorian, lunar-hijri, and seasonal-range
events across the six GCC countries (plus cross-country / shared entries
where country_iso is NULL). Lunar events store the (hijri_month, hijri_day)
tuple and are converted to Gregorian at query time by the Phase 1B utility,
so the table does not need yearly maintenance.

CHECK constraints enforce that the date columns match the event_type, that
cultural_significance is in 1..10, and that country_iso (when present) is
one of the six GCC ISO codes.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'p2c8d3e5f6a1'
down_revision: Union[str, None] = 'o1b7c2d3e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cultural_event',
        sa.Column(
            'id', postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text('uuid_generate_v4()'),
        ),
        sa.Column('event_key', sa.String(64), nullable=False, unique=True),
        sa.Column('name_en', sa.String(128), nullable=False),
        sa.Column('name_ar', sa.String(128), nullable=False),
        sa.Column('country_iso', sa.CHAR(2), nullable=True),
        sa.Column('event_type', sa.String(20), nullable=False),
        sa.Column('gregorian_month', sa.SmallInteger, nullable=True),
        sa.Column('gregorian_day', sa.SmallInteger, nullable=True),
        sa.Column('hijri_month', sa.SmallInteger, nullable=True),
        sa.Column('hijri_day', sa.SmallInteger, nullable=True),
        sa.Column(
            'duration_days', sa.SmallInteger,
            nullable=False, server_default=sa.text('1'),
        ),
        sa.Column('seasonal_start_month', sa.SmallInteger, nullable=True),
        sa.Column('seasonal_end_month', sa.SmallInteger, nullable=True),
        sa.Column('cultural_significance', sa.SmallInteger, nullable=False),
        sa.Column(
            'lead_time_days', sa.SmallInteger,
            nullable=False, server_default=sa.text('7'),
        ),
        sa.Column(
            'industries_high_relevance', postgresql.ARRAY(sa.Text),
            nullable=False, server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column('content_guidelines', postgresql.JSONB, nullable=False),
        sa.Column('audience_behavior', postgresql.JSONB, nullable=False),
        sa.Column('year_specific_notes', postgresql.JSONB, nullable=True),
        sa.Column('source_url', sa.String(512), nullable=True),
        sa.Column(
            'source_confidence', sa.String(20),
            nullable=False, server_default=sa.text("'secondary'"),
        ),
        sa.Column('last_verified', sa.Date, nullable=False),
        sa.Column(
            'is_active', sa.Boolean,
            nullable=False, server_default=sa.text('true'),
        ),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "event_type IN ('fixed_gregorian','lunar_hijri','seasonal_range')",
            name='cultural_event_type_chk',
        ),
        sa.CheckConstraint(
            "source_confidence IN ('verified','secondary','inferred')",
            name='cultural_event_source_conf_chk',
        ),
        sa.CheckConstraint(
            "country_iso IS NULL OR country_iso IN ('SA','AE','QA','KW','OM','BH')",
            name='cultural_event_country_chk',
        ),
        sa.CheckConstraint(
            'cultural_significance BETWEEN 1 AND 10',
            name='cultural_event_significance_chk',
        ),
        sa.CheckConstraint(
            'duration_days >= 1',
            name='cultural_event_duration_chk',
        ),
        sa.CheckConstraint(
            'lead_time_days >= 0',
            name='cultural_event_lead_time_chk',
        ),
        # Per-type date column requirements.
        # NOTE: explicit IS NOT NULL guards are required. Without them,
        # `NULL BETWEEN 1 AND 12` evaluates to NULL, and `NULL OR FALSE`
        # is NULL — which Postgres treats as a CHECK pass (only FALSE
        # rejects). The IS NOT NULL terms short-circuit to FALSE so the
        # whole expression resolves to a deterministic boolean.
        sa.CheckConstraint(
            "(event_type = 'fixed_gregorian' AND "
            " gregorian_month IS NOT NULL AND gregorian_day IS NOT NULL AND "
            " gregorian_month BETWEEN 1 AND 12 AND gregorian_day BETWEEN 1 AND 31 AND "
            " hijri_month IS NULL AND hijri_day IS NULL AND "
            " seasonal_start_month IS NULL AND seasonal_end_month IS NULL) "
            "OR event_type <> 'fixed_gregorian'",
            name='cultural_event_fixed_dates_chk',
        ),
        sa.CheckConstraint(
            "(event_type = 'lunar_hijri' AND "
            " hijri_month IS NOT NULL AND hijri_day IS NOT NULL AND "
            " hijri_month BETWEEN 1 AND 12 AND hijri_day BETWEEN 1 AND 30 AND "
            " gregorian_month IS NULL AND gregorian_day IS NULL AND "
            " seasonal_start_month IS NULL AND seasonal_end_month IS NULL) "
            "OR event_type <> 'lunar_hijri'",
            name='cultural_event_lunar_dates_chk',
        ),
        sa.CheckConstraint(
            "(event_type = 'seasonal_range' AND "
            " seasonal_start_month IS NOT NULL AND seasonal_end_month IS NOT NULL AND "
            " seasonal_start_month BETWEEN 1 AND 12 AND "
            " seasonal_end_month BETWEEN 1 AND 12 AND "
            " gregorian_month IS NULL AND gregorian_day IS NULL AND "
            " hijri_month IS NULL AND hijri_day IS NULL) "
            "OR event_type <> 'seasonal_range'",
            name='cultural_event_seasonal_dates_chk',
        ),
    )
    op.create_index(
        'idx_cultural_event_country_significance', 'cultural_event',
        ['country_iso', sa.text('cultural_significance DESC')],
    )
    op.create_index(
        'idx_cultural_event_type', 'cultural_event', ['event_type'],
    )
    op.create_index(
        'idx_cultural_event_updated', 'cultural_event',
        [sa.text('updated_at DESC')],
    )


def downgrade() -> None:
    op.drop_index('idx_cultural_event_updated', table_name='cultural_event')
    op.drop_index('idx_cultural_event_type', table_name='cultural_event')
    op.drop_index('idx_cultural_event_country_significance', table_name='cultural_event')
    op.drop_table('cultural_event')
