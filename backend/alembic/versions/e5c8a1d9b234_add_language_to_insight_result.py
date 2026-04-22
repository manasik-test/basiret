"""add language to insight_result

Revision ID: e5c8a1d9b234
Revises: d4b7c2a5e180
Create Date: 2026-04-22 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5c8a1d9b234'
down_revision: Union[str, None] = 'd4b7c2a5e180'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'insight_result',
        sa.Column(
            'language',
            sa.String(10),
            nullable=False,
            server_default=sa.text("'en'"),
        ),
    )
    op.create_index(
        'idx_insight_account_lang',
        'insight_result',
        ['social_account_id', 'language'],
    )


def downgrade() -> None:
    op.drop_index('idx_insight_account_lang', table_name='insight_result')
    op.drop_column('insight_result', 'language')
