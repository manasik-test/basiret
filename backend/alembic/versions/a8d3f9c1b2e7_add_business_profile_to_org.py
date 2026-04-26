"""add business_profile JSONB to organization

Revision ID: a8d3f9c1b2e7
Revises: f1a2b3c4d5e6
Create Date: 2026-04-26 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a8d3f9c1b2e7'
down_revision: Union[str, None] = 'b8c4d2f5a201'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'organization',
        sa.Column('business_profile', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('organization', 'business_profile')
