"""Weekly menu endpoints — one row per ISO week."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_session
from backend.models import MenuWeek
from backend.schemas import Envelope, MenuWeekIn, MenuWeekOut

router = APIRouter(prefix="/api/menu", tags=["menu"])


def _iso_week_to_monday(year_week: str) -> date:
    """'YYYY-WW' → date of the Monday of that ISO week."""
    try:
        y, w = year_week.split("-")
        year, week = int(y), int(w)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid week: {year_week}") from exc

    try:
        return date.fromisocalendar(year, week, 1)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid week: {year_week}") from exc


@router.get("/week/{year_week}", response_model=Envelope[MenuWeekOut])
async def get_week(
    year_week: str, session: AsyncSession = Depends(get_session)
) -> Envelope[MenuWeekOut]:
    monday = _iso_week_to_monday(year_week)
    stmt = select(MenuWeek).where(MenuWeek.week_start == monday)
    existing = (await session.execute(stmt)).scalar_one_or_none()

    if existing is None:
        # Return an in-memory empty payload so the frontend always has a shape.
        empty: dict[str, object] = {
            "id": 0,
            "week_start": monday,
            "updated_at": datetime.utcnow(),
        }
        for field_name in MenuWeekIn.model_fields:
            empty[field_name] = ""
        return Envelope(data=MenuWeekOut.model_validate(empty))

    return Envelope(data=MenuWeekOut.model_validate(existing))


@router.put("/week/{year_week}", response_model=Envelope[MenuWeekOut])
async def upsert_week(
    year_week: str,
    payload: MenuWeekIn,
    session: AsyncSession = Depends(get_session),
) -> Envelope[MenuWeekOut]:
    monday = _iso_week_to_monday(year_week)
    stmt = select(MenuWeek).where(MenuWeek.week_start == monday)
    existing = (await session.execute(stmt)).scalar_one_or_none()

    data = payload.model_dump()

    if existing is None:
        existing = MenuWeek(week_start=monday, **data)
        session.add(existing)
    else:
        for k, v in data.items():
            setattr(existing, k, v)

    await session.commit()
    await session.refresh(existing)
    return Envelope(data=MenuWeekOut.model_validate(existing))
