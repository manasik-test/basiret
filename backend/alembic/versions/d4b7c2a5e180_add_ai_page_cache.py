"""add ai_page_cache table

Revision ID: d4b7c2a5e180
Revises: c1f3d2e8a9b1
Create Date: 2026-04-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4b7c2a5e180'
down_revision: Union[str, None] = 'c1f3d2e8a9b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_page_cache',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('uuid_generate_v4()')),
        sa.Column('social_account_id', sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('social_account.id', ondelete='CASCADE'), nullable=False),
        sa.Column('page_name', sa.String(64), nullable=False),
        sa.Column('language', sa.String(8), nullable=False, server_default=sa.text("'en'")),
        sa.Column('content', sa.dialects.postgresql.JSONB, nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('social_account_id', 'page_name', 'language', name='uq_ai_page_cache_key'),
    )
    op.create_index(
        'idx_ai_page_cache_lookup',
        'ai_page_cache',
        ['social_account_id', 'page_name', 'language'],
    )


def downgrade() -> None:
    op.drop_index('idx_ai_page_cache_lookup', table_name='ai_page_cache')
    op.drop_table('ai_page_cache')
