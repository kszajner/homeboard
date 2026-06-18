"""Pydantic schemas for API requests and responses."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class Envelope(BaseModel, Generic[T]):
    """Standard API envelope: { data, error }."""

    data: T | None = None
    error: str | None = None


# --- Calendar ---


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uid: str
    calendar_name: str
    title: str
    description: str | None = None
    location: str | None = None
    start: datetime
    end: datetime
    all_day: bool


class CalendarStatus(BaseModel):
    last_refresh_at: datetime | None
    last_success_at: datetime | None
    is_stale: bool
    last_errors: list[str]
    calendars: list[dict[str, Any]]


# --- Bills ---


class BillBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    amount: float = Field(ge=0)
    due_date: date
    bill_type: str = Field(default="one_time")  # one_time | recurring | subscription
    is_recurring: bool = False


class BillCreate(BillBase):
    pass


class BillUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    amount: float | None = Field(default=None, ge=0)
    due_date: date | None = None
    bill_type: str | None = None
    is_recurring: bool | None = None
    paid: bool | None = None


class BillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    amount: float
    due_date: date
    paid: bool
    paid_at: datetime | None
    bill_type: str
    is_recurring: bool
    parent_id: int | None
    created_at: datetime


# --- Kanban ---


KANBAN_COLUMNS = ("todo", "in_progress", "done")


class KanbanCardCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    column: str = Field(default="todo")
    due_date: date | None = None


class KanbanCardUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    column: str | None = None
    position: int | None = None
    due_date: date | None = None


class KanbanSubtaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)


class KanbanSubtaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    done: bool | None = None
    position: int | None = None


class KanbanSubtaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    card_id: int
    title: str
    done: bool
    position: int
    created_at: datetime


class KanbanCardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    column: str
    position: int
    due_date: date | None
    created_at: datetime
    updated_at: datetime
    subtasks: list[KanbanSubtaskOut] = Field(default_factory=list)


# --- Menu ---


class MenuWeekIn(BaseModel):
    monday_lunch: str = ""
    monday_notes: str = ""
    tuesday_lunch: str = ""
    tuesday_notes: str = ""
    wednesday_lunch: str = ""
    wednesday_notes: str = ""
    thursday_lunch: str = ""
    thursday_notes: str = ""
    friday_lunch: str = ""
    friday_notes: str = ""
    saturday_lunch: str = ""
    saturday_notes: str = ""
    sunday_lunch: str = ""
    sunday_notes: str = ""


class MenuWeekOut(MenuWeekIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    week_start: date
    updated_at: datetime
