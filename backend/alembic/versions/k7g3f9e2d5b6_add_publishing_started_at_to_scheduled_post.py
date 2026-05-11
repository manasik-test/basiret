"""add publishing_started_at column to scheduled_post

Revision ID: k7g3f9e2d5b6
Revises: j6f2e8d1c4a5
Create Date: 2026-05-11 13:00:00.000000

Powers the stale-publishing recovery in dispatch_due_posts: a worker crash
mid-publish would otherwise leave the row in status='publishing' forever.
The dispatcher now picks up rows whose publishing_started_at is older than
10 minutes, and the atomic claim in publish_scheduled_post accepts that
same condition so the recovery is race-safe.

NULL means "not currently publishing" — correct for all pre-existing rows.
No backfill needed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k7g3f9e2d5b6"
down_revision: Union[str, None] = "j6f2e8d1c4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scheduled_post",
        sa.Column("publishing_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Partial index — only rows actively in `publishing` state matter for
    # stale-recovery scans, which keeps the index small.
    op.create_index(
        "idx_scheduled_post_publishing_started",
        "scheduled_post",
        ["publishing_started_at"],
        postgresql_where=sa.text("status = 'publishing'"),
    )


def downgrade() -> None:
    op.drop_index("idx_scheduled_post_publishing_started", table_name="scheduled_post")
    op.drop_column("scheduled_post", "publishing_started_at")
