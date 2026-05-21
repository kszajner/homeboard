"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-21

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("paid", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("bill_type", sa.String(length=20), nullable=False, server_default="one_time"),
        sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "parent_id",
            sa.Integer(),
            sa.ForeignKey("bills.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_bills_due_date", "bills", ["due_date"])

    op.create_table(
        "kanban_cards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("column", sa.String(length=20), nullable=False, server_default="todo"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_kanban_cards_column", "kanban_cards", ["column"])

    op.create_table(
        "menu_weeks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("week_start", sa.Date(), nullable=False, unique=True),
        sa.Column("monday_lunch", sa.Text(), nullable=False, server_default=""),
        sa.Column("monday_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("tuesday_lunch", sa.Text(), nullable=False, server_default=""),
        sa.Column("tuesday_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("wednesday_lunch", sa.Text(), nullable=False, server_default=""),
        sa.Column("wednesday_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("thursday_lunch", sa.Text(), nullable=False, server_default=""),
        sa.Column("thursday_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("friday_lunch", sa.Text(), nullable=False, server_default=""),
        sa.Column("friday_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("saturday_lunch", sa.Text(), nullable=False, server_default=""),
        sa.Column("saturday_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("sunday_lunch", sa.Text(), nullable=False, server_default=""),
        sa.Column("sunday_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_menu_weeks_week_start", "menu_weeks", ["week_start"])

    op.create_table(
        "cached_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("uid", sa.String(length=500), nullable=False),
        sa.Column("calendar_name", sa.String(length=200), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location", sa.String(length=500), nullable=True),
        sa.Column("start", sa.DateTime(), nullable=False),
        sa.Column("end", sa.DateTime(), nullable=False),
        sa.Column("all_day", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "fetched_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("uid", "calendar_name", "start", name="uq_cached_event"),
    )
    op.create_index("ix_cached_events_uid", "cached_events", ["uid"])
    op.create_index("ix_cached_events_calendar_name", "cached_events", ["calendar_name"])
    op.create_index("ix_cached_events_start", "cached_events", ["start"])


def downgrade() -> None:
    op.drop_index("ix_cached_events_start", table_name="cached_events")
    op.drop_index("ix_cached_events_calendar_name", table_name="cached_events")
    op.drop_index("ix_cached_events_uid", table_name="cached_events")
    op.drop_table("cached_events")

    op.drop_index("ix_menu_weeks_week_start", table_name="menu_weeks")
    op.drop_table("menu_weeks")

    op.drop_index("ix_kanban_cards_column", table_name="kanban_cards")
    op.drop_table("kanban_cards")

    op.drop_index("ix_bills_due_date", table_name="bills")
    op.drop_table("bills")
