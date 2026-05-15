"""add language column to audience_segment for per-language personas

Revision ID: n0a6b8c9e1d3
Revises: m9i5h1g4f7d8
Create Date: 2026-05-15 09:00:00.000000

Per-language personas (Bug 2 from 2026-05-15 three-bug fix). Persona
descriptions are AI-generated prose, and the segmentation task used to store
exactly one row per cluster — so toggling UI language showed stale prose in
the wrong language. After this migration, segments are partitioned by
(account, cluster_id, language) so EN and AR personas coexist for the same
clustering result, and `GET /audience-insights` (and `useSegments`) can pick
the row matching the request language without firing a re-segmentation.

Backfill: existing rows are stamped `'en'`. Practically every row in prod
today was generated under an English-default code path (the language
parameter only started being forwarded in commit fc1c46c5), so this is
correct for the vast majority. Users with stale Arabic prose under their
single existing row will get fresh dual-language output on their next
"Regenerate Segments" click.

This migration also adds the unique constraint (account, cluster_id,
language) — the segmentation task already does delete-then-insert per
account, so there's no existing-row collision to worry about.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "n0a6b8c9e1d3"
down_revision: Union[str, None] = "m9i5h1g4f7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "audience_segment",
        sa.Column(
            "language",
            sa.String(10),
            nullable=False,
            server_default=sa.text("'en'"),
        ),
    )
    op.create_index(
        "idx_audience_segment_account_lang",
        "audience_segment",
        ["social_account_id", "language"],
    )
    op.create_unique_constraint(
        "uq_audience_segment_account_cluster_lang",
        "audience_segment",
        ["social_account_id", "cluster_id", "language"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_audience_segment_account_cluster_lang",
        "audience_segment",
        type_="unique",
    )
    op.drop_index(
        "idx_audience_segment_account_lang",
        table_name="audience_segment",
    )
    op.drop_column("audience_segment", "language")
