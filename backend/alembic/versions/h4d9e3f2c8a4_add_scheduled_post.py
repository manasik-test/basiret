"""add scheduled_post table

Revision ID: h4d9e3f2c8a4
Revises: g3c8d2f4a7b1
Create Date: 2026-05-02 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'h4d9e3f2c8a4'
down_revision: Union[str, None] = 'g3c8d2f4a7b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scheduled_post",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "organization_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organization.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "social_account_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("social_account.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "media_urls", postgresql.JSONB(astext_type=sa.Text()),
            nullable=False, server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("media_type", sa.String(20)),
        sa.Column("caption_ar", sa.Text()),
        sa.Column("caption_en", sa.Text()),
        sa.Column(
            "hashtags", postgresql.JSONB(astext_type=sa.Text()),
            nullable=False, server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("ratio", sa.String(10)),
        sa.Column("scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column(
            "status", sa.String(20), nullable=False,
            server_default=sa.text("'draft'"),
        ),
        sa.Column("platform_post_id", sa.String(255)),
        sa.Column(
            "ai_generated_media", sa.Boolean(), nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "ai_generated_caption", sa.Boolean(), nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("source_image_url", sa.Text()),
        sa.Column("content_plan_day", sa.Date()),
        sa.Column("draft_expires_at", sa.DateTime(timezone=True)),
        sa.Column("error_message", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_scheduled_post_org_status", "scheduled_post",
        ["organization_id", "status"],
    )
    op.create_index(
        "idx_scheduled_post_account_scheduled", "scheduled_post",
        ["social_account_id", "scheduled_at"],
    )
    op.create_index(
        "idx_scheduled_post_status_expires", "scheduled_post",
        ["status", "draft_expires_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_scheduled_post_status_expires", table_name="scheduled_post")
    op.drop_index("idx_scheduled_post_account_scheduled", table_name="scheduled_post")
    op.drop_index("idx_scheduled_post_org_status", table_name="scheduled_post")
    op.drop_table("scheduled_post")
