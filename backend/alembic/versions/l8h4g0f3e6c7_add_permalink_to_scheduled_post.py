"""add permalink column to scheduled_post

Revision ID: l8h4g0f3e6c7
Revises: k7g3f9e2d5b6
Create Date: 2026-05-11 14:00:00.000000

Populated by the publisher after /media_publish succeeds: an extra
GET /{media_id}?fields=permalink call fetches the public IG URL
(uses a shortcode, e.g. /p/CXyZAbCdEf-/, not the numeric media_id).

NULL means "permalink not yet fetched" — could mean the post is
pre-fix (manual backfill needed) or that the post-publish permalink
fetch failed (a soft failure, the post itself is live on IG).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "l8h4g0f3e6c7"
down_revision: Union[str, None] = "k7g3f9e2d5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scheduled_post",
        sa.Column("permalink", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scheduled_post", "permalink")
