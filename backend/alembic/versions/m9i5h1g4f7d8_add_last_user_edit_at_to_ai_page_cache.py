"""Add last_user_edit_at to ai_page_cache.

Tracks when a user manually overwrote a cached AI suggestion (today: the
Content Plan "Update the suggestion" cancel option). Distinct from
`generated_at` — the cache TTL logic still keys off `generated_at`, so a
user edit is preserved only until the next Gemini regeneration overwrites
the row. The wizard's cancel-dialog copy ("until next refresh") sets that
expectation.

Revision ID: m9i5h1g4f7d8
Revises: l8h4g0f3e6c7
Create Date: 2026-05-12 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "m9i5h1g4f7d8"
down_revision: Union[str, None] = "l8h4g0f3e6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ai_page_cache",
        sa.Column("last_user_edit_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ai_page_cache", "last_user_edit_at")
