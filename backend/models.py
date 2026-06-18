"""SQLAlchemy ORM models for the Home Dashboard."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from backend.database import Base


class Bill(Base):
    """A bill: one-time payment, recurring monthly, or subscription."""

    __tablename__ = "bills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # 'one_time' | 'recurring' | 'subscription'
    bill_type: Mapped[str] = mapped_column(String(20), default="one_time", nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("bills.id", ondelete="SET NULL"), nullable=True
    )
    children: Mapped[list["Bill"]] = relationship(
        "Bill", backref="parent", remote_side="Bill.id"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class KanbanCard(Base):
    """A single card on the global Kanban board."""

    __tablename__ = "kanban_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 'todo' | 'in_progress' | 'done'
    column: Mapped[str] = mapped_column(String(20), default="todo", nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    subtasks: Mapped[list["KanbanSubtask"]] = relationship(
        "KanbanSubtask",
        back_populates="card",
        cascade="all, delete-orphan",
        order_by="KanbanSubtask.position",
    )


class KanbanSubtask(Base):
    """A checklist item belonging to a Kanban card."""

    __tablename__ = "kanban_subtasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    card_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("kanban_cards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    card: Mapped["KanbanCard"] = relationship("KanbanCard", back_populates="subtasks")


class MenuWeek(Base):
    """Weekly lunch menu — one row per ISO week."""

    __tablename__ = "menu_weeks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    week_start: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)

    monday_lunch: Mapped[str] = mapped_column(Text, default="", nullable=False)
    monday_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    tuesday_lunch: Mapped[str] = mapped_column(Text, default="", nullable=False)
    tuesday_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    wednesday_lunch: Mapped[str] = mapped_column(Text, default="", nullable=False)
    wednesday_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    thursday_lunch: Mapped[str] = mapped_column(Text, default="", nullable=False)
    thursday_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    friday_lunch: Mapped[str] = mapped_column(Text, default="", nullable=False)
    friday_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    saturday_lunch: Mapped[str] = mapped_column(Text, default="", nullable=False)
    saturday_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    sunday_lunch: Mapped[str] = mapped_column(Text, default="", nullable=False)
    sunday_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class CachedEvent(Base):
    """Cached calendar event sourced from an iCloud .ics feed."""

    __tablename__ = "cached_events"
    __table_args__ = (
        UniqueConstraint("uid", "calendar_name", "start", name="uq_cached_event"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    uid: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    calendar_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)

    start: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    fetched_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
