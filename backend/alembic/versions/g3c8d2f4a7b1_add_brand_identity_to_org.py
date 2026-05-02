"""add brand_identity JSONB column to organization

Revision ID: g3c8d2f4a7b1
Revises: c2e3a4f6d789
Create Date: 2026-05-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'g3c8d2f4a7b1'
down_revision: Union[str, None] = 'c2e3a4f6d789'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'organization',
        sa.Column('brand_identity', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('organization', 'brand_identity')
