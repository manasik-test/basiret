"""add content-plan batch generation tables + user prefs

Revision ID: o1b7c2d3e4f5
Revises: n0a6b8c9e1d3
Create Date: 2026-05-15 12:00:00.000000

Day 3-4 / Week 1 — Content Plan batch generation.

Two changes:

1. New `batch_generate_progress` table tracking server-side state of an in-flight
   "Generate all 7 posts" batch. The Celery task writes per-day progress into
   `per_day_status` (JSONB) so the frontend can poll a single endpoint to render
   "Monday — Image ready ✓ | Caption ready ✓ | Tuesday — Generating…" without
   chasing Celery AsyncResult metadata across multiple keys.

2. Two new columns on `user`: `batch_generate_default_action` (nullable, 'drafts'
   or 'schedule') and `batch_generate_remember` (boolean, default false). Together
   they encode the "remember my choice for next time" preference so subsequent
   clicks on "Generate all 7 posts" can skip the confirmation dialog entirely.
   Nullable + default-false keeps existing users at "show dialog every time"
   unless they explicitly opt in.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "o1b7c2d3e4f5"
down_revision: Union[str, None] = "n0a6b8c9e1d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("batch_generate_default_action", sa.String(20), nullable=True),
    )
    op.add_column(
        "user",
        sa.Column(
            "batch_generate_remember",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_table(
        "batch_generate_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organization.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "social_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("social_account.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("language", sa.String(8), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'running'")),
        sa.Column("per_day_status", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    # Frontend cross-navigation persistence: "is there a running batch for
    # this account+language right now?" — needs (account_id, language, status)
    # to be fast since it's queried on every Content Plan page mount.
    op.create_index(
        "idx_batch_progress_account_lang_status",
        "batch_generate_progress",
        ["social_account_id", "language", "status"],
    )
    op.create_index(
        "idx_batch_progress_org",
        "batch_generate_progress",
        ["organization_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_batch_progress_org",
        table_name="batch_generate_progress",
    )
    op.drop_index(
        "idx_batch_progress_account_lang_status",
        table_name="batch_generate_progress",
    )
    op.drop_table("batch_generate_progress")
    op.drop_column("user", "batch_generate_remember")
    op.drop_column("user", "batch_generate_default_action")
