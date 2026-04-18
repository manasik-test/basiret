"""add comment table and comment_id on analysis_result

Revision ID: c1f3d2e8a9b1
Revises: b7a7452b8cee
Create Date: 2026-04-19 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1f3d2e8a9b1'
down_revision: Union[str, None] = 'b7a7452b8cee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'comment',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('uuid_generate_v4()')),
        sa.Column('post_id', sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('post.id', ondelete='CASCADE'), nullable=False),
        sa.Column('platform_comment_id', sa.String(255), nullable=False, unique=True),
        sa.Column('text', sa.Text()),
        sa.Column('author_username', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True)),
        sa.Column('fetched_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_comment_post', 'comment', ['post_id'])
    op.create_index('idx_comment_created', 'comment', ['created_at'])

    # analysis_result: relax post_id, add comment_id, add XOR constraint
    op.alter_column('analysis_result', 'post_id', nullable=True)
    op.add_column(
        'analysis_result',
        sa.Column('comment_id', sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('comment.id', ondelete='CASCADE'), nullable=True, unique=True),
    )
    op.create_index('idx_analysis_comment', 'analysis_result', ['comment_id'])
    op.create_check_constraint(
        'analysis_result_target_xor',
        'analysis_result',
        '(post_id IS NOT NULL) <> (comment_id IS NOT NULL)',
    )


def downgrade() -> None:
    op.drop_constraint('analysis_result_target_xor', 'analysis_result', type_='check')
    op.drop_index('idx_analysis_comment', table_name='analysis_result')
    op.drop_column('analysis_result', 'comment_id')
    op.alter_column('analysis_result', 'post_id', nullable=False)

    op.drop_index('idx_comment_created', table_name='comment')
    op.drop_index('idx_comment_post', table_name='comment')
    op.drop_table('comment')
