"""add feature_flag table with seeded defaults

Revision ID: c2e3a4f6d789
Revises: a8d3f9c1b2e7
Create Date: 2026-04-26 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c2e3a4f6d789'
down_revision: Union[str, None] = 'a8d3f9c1b2e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SEED_ROWS = [
    ('starter',    'sentiment_analysis',      False),
    ('starter',    'audience_segmentation',   False),
    ('starter',    'recommendations',         False),
    ('starter',    'content_recommendations', False),
    ('starter',    'arabic_nlp',              False),
    ('starter',    'history_12mo',            False),
    ('insights',   'sentiment_analysis',      True),
    ('insights',   'audience_segmentation',   True),
    ('insights',   'recommendations',         True),
    ('insights',   'content_recommendations', True),
    ('insights',   'arabic_nlp',              True),
    ('insights',   'history_12mo',            True),
    ('enterprise', 'sentiment_analysis',      True),
    ('enterprise', 'audience_segmentation',   True),
    ('enterprise', 'recommendations',         True),
    ('enterprise', 'content_recommendations', True),
    ('enterprise', 'arabic_nlp',              True),
    ('enterprise', 'history_12mo',            True),
]


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS feature_flag (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            plan_tier plan_tier NOT NULL,
            feature_name VARCHAR(100) NOT NULL,
            is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            UNIQUE(plan_tier, feature_name)
        )
    """))

    for plan_tier, feature_name, is_enabled in SEED_ROWS:
        bind.execute(
            sa.text("""
                INSERT INTO feature_flag (plan_tier, feature_name, is_enabled)
                VALUES (:plan_tier, :feature_name, :is_enabled)
                ON CONFLICT (plan_tier, feature_name) DO NOTHING
            """),
            {
                "plan_tier": plan_tier,
                "feature_name": feature_name,
                "is_enabled": is_enabled,
            },
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS feature_flag")
