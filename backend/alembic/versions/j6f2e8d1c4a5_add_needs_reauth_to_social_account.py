"""add needs_reauth column to social_account

Revision ID: j6f2e8d1c4a5
Revises: i5e1f4a3b9d2
Create Date: 2026-05-10 12:00:00.000000

Sprint 5 — Instagram Publishing. Marks accounts whose long-lived token has
been rejected by the Graph API (OAuthException code 190) so the publisher
stops trying to use it and the UI can prompt the user to reconnect.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j6f2e8d1c4a5"
down_revision: Union[str, None] = "i5e1f4a3b9d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "social_account",
        sa.Column(
            "needs_reauth",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("social_account", "needs_reauth")
