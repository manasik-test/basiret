"""add ai_usage_log table

Revision ID: f1a2b3c4d5e6
Revises: e5c8a1d9b234
Create Date: 2026-04-23 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e5c8a1d9b234'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_usage_log',
        sa.Column(
            'id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text('uuid_generate_v4()'),
        ),
        sa.Column(
            'social_account_id', sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey('social_account.id', ondelete='CASCADE'),
            nullable=True,
        ),
        sa.Column('provider', sa.String(20), nullable=False),
        sa.Column('task', sa.String(20), nullable=False),
        sa.Column('source', sa.String(20), nullable=False, server_default=sa.text("'user'")),
        sa.Column('tokens_used', sa.Integer, nullable=True),
        sa.Column(
            'called_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
    )
    op.create_index(
        'idx_ai_usage_account_called', 'ai_usage_log',
        ['social_account_id', 'called_at'],
    )
    op.create_index(
        'idx_ai_usage_provider_called', 'ai_usage_log',
        ['provider', 'called_at'],
    )


def downgrade() -> None:
    op.drop_index('idx_ai_usage_provider_called', table_name='ai_usage_log')
    op.drop_index('idx_ai_usage_account_called', table_name='ai_usage_log')
    op.drop_table('ai_usage_log')
