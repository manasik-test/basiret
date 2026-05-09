"""add image_analysis JSONB column to scheduled_post

Revision ID: i5e1f4a3b9d2
Revises: h4d9e3f2c8a4
Create Date: 2026-05-09 10:00:00.000000

Sprint 4 — populated by `POST /api/v1/creator/analyze-image` (GPT-4o Vision)
when the user uploads an image, and consumed by the caption generator so
output captions describe what's actually in the image.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "i5e1f4a3b9d2"
down_revision: Union[str, None] = "h4d9e3f2c8a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scheduled_post",
        sa.Column(
            "image_analysis",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("scheduled_post", "image_analysis")
