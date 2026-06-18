"""kanban subtasks

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-18

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "kanban_subtasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "card_id",
            sa.Integer(),
            sa.ForeignKey("kanban_cards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("done", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_kanban_subtasks_card_id", "kanban_subtasks", ["card_id"])


def downgrade() -> None:
    op.drop_index("ix_kanban_subtasks_card_id", table_name="kanban_subtasks")
    op.drop_table("kanban_subtasks")
