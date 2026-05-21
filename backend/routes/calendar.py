"""Calendar API routes — reads cached events; refresh is handled by the scheduler."""
from __future__ import annotations

import calendar as stdcal
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, HTTPException, Query

from backend.schemas import CalendarStatus, Envelope, EventOut
from backend.services import ical
from dataclasses import asdict

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def _parse_iso_date(value: str, field_name: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}: {value}") from exc


@router.get("/events", response_model=Envelope[list[EventOut]])
async def list_events(
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
) -> Envelope[list[EventOut]]:
    start_date = _parse_iso_date(from_, "from")
    end_date = _parse_iso_date(to, "to")
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time.max)
    events = await ical.events_in_range(start_dt, end_dt)
    return Envelope(data=[EventOut.model_validate(e) for e in events])


@router.get("/month/{year_month}", response_model=Envelope[list[EventOut]])
async def list_month(year_month: str) -> Envelope[list[EventOut]]:
    try:
        year_str, month_str = year_month.split("-", 1)
        year, month = int(year_str), int(month_str)
        if not 1 <= month <= 12:
            raise ValueError
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid YYYY-MM: {year_month}") from exc

    first = date(year, month, 1)
    last_day = stdcal.monthrange(year, month)[1]
    last = date(year, month, last_day)
    # Pad by one day on each side so events that straddle the boundary still show.
    start_dt = datetime.combine(first - timedelta(days=1), time.min)
    end_dt = datetime.combine(last + timedelta(days=1), time.max)

    events = await ical.events_in_range(start_dt, end_dt)
    return Envelope(data=[EventOut.model_validate(e) for e in events])


@router.get("/status", response_model=Envelope[CalendarStatus])
async def status() -> Envelope[CalendarStatus]:
    s = ical.state
    payload = CalendarStatus(
        last_refresh_at=s.last_refresh_at,
        last_success_at=s.last_success_at,
        is_stale=s.is_stale,
        last_errors=s.last_errors,
        calendars=[asdict(c) for c in s.calendars],
    )
    return Envelope(data=payload)


@router.post("/refresh", response_model=Envelope[CalendarStatus])
async def force_refresh() -> Envelope[CalendarStatus]:
    """Manual refresh trigger — useful for debugging and the eventual Settings UI."""
    s = await ical.refresh_all()
    payload = CalendarStatus(
        last_refresh_at=s.last_refresh_at,
        last_success_at=s.last_success_at,
        is_stale=s.is_stale,
        last_errors=s.last_errors,
        calendars=[asdict(c) for c in s.calendars],
    )
    return Envelope(data=payload)
