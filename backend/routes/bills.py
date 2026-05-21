"""Bills CRUD endpoints."""
from __future__ import annotations

import calendar as stdcal
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_session
from backend.models import Bill
from backend.schemas import BillCreate, BillOut, BillUpdate, Envelope

router = APIRouter(prefix="/api/bills", tags=["bills"])


def _next_due_date(current: date) -> date:
    """Add one calendar month, clamping to the last day if needed."""
    year = current.year + (1 if current.month == 12 else 0)
    month = 1 if current.month == 12 else current.month + 1
    last_day = stdcal.monthrange(year, month)[1]
    return date(year, month, min(current.day, last_day))


@router.get("", response_model=Envelope[list[BillOut]])
async def list_bills(
    month: str | None = Query(default=None, description="YYYY-MM filter"),
    session: AsyncSession = Depends(get_session),
) -> Envelope[list[BillOut]]:
    stmt = select(Bill).order_by(Bill.due_date)
    if month:
        try:
            y, m = month.split("-")
            year, month_n = int(y), int(m)
            if not 1 <= month_n <= 12:
                raise ValueError
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid month: {month}") from exc
        last = stdcal.monthrange(year, month_n)[1]
        first_d = date(year, month_n, 1)
        last_d = date(year, month_n, last)
        stmt = stmt.where(Bill.due_date >= first_d, Bill.due_date <= last_d)

    result = await session.execute(stmt)
    bills = result.scalars().all()
    return Envelope(data=[BillOut.model_validate(b) for b in bills])


@router.get("/{bill_id}", response_model=Envelope[BillOut])
async def get_bill(
    bill_id: int, session: AsyncSession = Depends(get_session)
) -> Envelope[BillOut]:
    bill = await session.get(Bill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return Envelope(data=BillOut.model_validate(bill))


@router.post("", response_model=Envelope[BillOut])
async def create_bill(
    payload: BillCreate, session: AsyncSession = Depends(get_session)
) -> Envelope[BillOut]:
    bill = Bill(
        title=payload.title,
        amount=payload.amount,
        due_date=payload.due_date,
        bill_type=payload.bill_type,
        is_recurring=payload.is_recurring or payload.bill_type in ("recurring", "subscription"),
    )
    session.add(bill)
    await session.commit()
    await session.refresh(bill)
    return Envelope(data=BillOut.model_validate(bill))


@router.put("/{bill_id}", response_model=Envelope[BillOut])
async def update_bill(
    bill_id: int,
    payload: BillUpdate,
    session: AsyncSession = Depends(get_session),
) -> Envelope[BillOut]:
    bill = await session.get(Bill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    was_paid = bill.paid

    if payload.title is not None:
        bill.title = payload.title
    if payload.amount is not None:
        bill.amount = payload.amount
    if payload.due_date is not None:
        bill.due_date = payload.due_date
    if payload.bill_type is not None:
        bill.bill_type = payload.bill_type
    if payload.is_recurring is not None:
        bill.is_recurring = payload.is_recurring

    if payload.paid is not None:
        bill.paid = payload.paid
        bill.paid_at = datetime.utcnow() if payload.paid else None

    just_paid = payload.paid is True and not was_paid

    # Auto-create the next instance for recurring/subscription bills.
    spawn_next = (
        just_paid
        and bill.is_recurring
        and bill.bill_type in ("recurring", "subscription")
    )

    await session.commit()
    await session.refresh(bill)

    if spawn_next:
        # Only spawn if the next instance does not already exist.
        next_due = _next_due_date(bill.due_date)
        existing_q = select(Bill).where(
            Bill.parent_id == bill.id,
            Bill.due_date == next_due,
        )
        existing = (await session.execute(existing_q)).scalar_one_or_none()
        if existing is None:
            next_bill = Bill(
                title=bill.title,
                amount=bill.amount,
                due_date=next_due,
                bill_type=bill.bill_type,
                is_recurring=True,
                parent_id=bill.id,
            )
            session.add(next_bill)
            await session.commit()

    return Envelope(data=BillOut.model_validate(bill))


@router.delete("/{bill_id}", response_model=Envelope[dict])
async def delete_bill(
    bill_id: int, session: AsyncSession = Depends(get_session)
) -> Envelope[dict]:
    bill = await session.get(Bill, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    await session.delete(bill)
    await session.commit()
    return Envelope(data={"deleted": bill_id})
