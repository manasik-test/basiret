"""add recommendation_feedback table

Revision ID: b8c4d2f5a201
Revises: a7b3c9d2e101
Create Date: 2026-04-23 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b8c4d2f5a201'
down_revision: Union[str, None] = 'a7b3c9d2e101'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


feedback_kind = postgresql.ENUM('helpful', 'not_helpful', name='feedback_kind')


def upgrade() -> None:
    bind = op.get_bind()
    feedback_kind.create(bind, checkfirst=True)

    op.create_table(
        'recommendation_feedback',
        sa.Column(
            'id', postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text('uuid_generate_v4()'),
        ),
        sa.Column(
            'organization_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('organization.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'social_account_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('social_account.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'insight_result_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('insight_result.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('recommendation_text', sa.Text, nullable=False),
        sa.Column(
            'feedback',
            postgresql.ENUM('helpful', 'not_helpful', name='feedback_kind', create_type=False),
            nullable=False,
        ),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            'social_account_id', 'recommendation_text',
            name='uq_rec_feedback_account_text',
        ),
    )
    op.create_index(
        'idx_rec_feedback_org', 'recommendation_feedback', ['organization_id'],
    )


def downgrade() -> None:
    op.drop_index('idx_rec_feedback_org', table_name='recommendation_feedback')
    op.drop_table('recommendation_feedback')
    postgresql.ENUM(name='feedback_kind').drop(op.get_bind(), checkfirst=True)
