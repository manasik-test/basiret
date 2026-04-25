"""add goal table

Revision ID: a7b3c9d2e101
Revises: f1a2b3c4d5e6
Create Date: 2026-04-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a7b3c9d2e101'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


goal_metric = postgresql.ENUM(
    'avg_engagement_rate', 'posts_per_week',
    'positive_sentiment_pct', 'follower_growth_pct',
    name='goal_metric',
)
goal_period = postgresql.ENUM('weekly', 'monthly', name='goal_period')


def upgrade() -> None:
    bind = op.get_bind()
    goal_metric.create(bind, checkfirst=True)
    goal_period.create(bind, checkfirst=True)

    op.create_table(
        'goal',
        sa.Column(
            'id', postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text('uuid_generate_v4()'),
        ),
        sa.Column(
            'organization_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('organization.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'social_account_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('social_account.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'metric',
            postgresql.ENUM(
                'avg_engagement_rate', 'posts_per_week',
                'positive_sentiment_pct', 'follower_growth_pct',
                name='goal_metric', create_type=False,
            ),
            nullable=False,
        ),
        sa.Column('target_value', sa.Float, nullable=False),
        sa.Column(
            'period',
            postgresql.ENUM('weekly', 'monthly', name='goal_period', create_type=False),
            nullable=False, server_default=sa.text("'weekly'"),
        ),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.text('TRUE')),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
    )
    op.create_index('idx_goal_org_active', 'goal', ['organization_id', 'is_active'])
    op.create_index('idx_goal_account_active', 'goal', ['social_account_id', 'is_active'])


def downgrade() -> None:
    op.drop_index('idx_goal_account_active', table_name='goal')
    op.drop_index('idx_goal_org_active', table_name='goal')
    op.drop_table('goal')
    bind = op.get_bind()
    postgresql.ENUM(name='goal_period').drop(bind, checkfirst=True)
    postgresql.ENUM(name='goal_metric').drop(bind, checkfirst=True)
