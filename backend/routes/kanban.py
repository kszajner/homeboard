"""Kanban CRUD endpoints — single board, three fixed columns."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_session
from backend.models import KanbanCard
from backend.schemas import (
    Envelope,
    KANBAN_COLUMNS,
    KanbanCardCreate,
    KanbanCardOut,
    KanbanCardUpdate,
)

router = APIRouter(prefix="/api/kanban", tags=["kanban"])


def _validate_column(column: str) -> None:
    if column not in KANBAN_COLUMNS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid column: {column}. Must be one of {list(KANBAN_COLUMNS)}",
        )


@router.get("/cards", response_model=Envelope[list[KanbanCardOut]])
async def list_cards(
    session: AsyncSession = Depends(get_session),
) -> Envelope[list[KanbanCardOut]]:
    stmt = select(KanbanCard).order_by(KanbanCard.column, KanbanCard.position)
    result = await session.execute(stmt)
    cards = result.scalars().all()
    return Envelope(data=[KanbanCardOut.model_validate(c) for c in cards])


@router.post("/cards", response_model=Envelope[KanbanCardOut])
async def create_card(
    payload: KanbanCardCreate,
    session: AsyncSession = Depends(get_session),
) -> Envelope[KanbanCardOut]:
    _validate_column(payload.column)
    # Append to the bottom of the target column.
    last_position_stmt = (
        select(KanbanCard.position)
        .where(KanbanCard.column == payload.column)
        .order_by(KanbanCard.position.desc())
        .limit(1)
    )
    last = (await session.execute(last_position_stmt)).scalar_one_or_none()
    next_position = (last or 0) + 1

    card = KanbanCard(
        title=payload.title,
        description=payload.description,
        column=payload.column,
        position=next_position,
        due_date=payload.due_date,
    )
    session.add(card)
    await session.commit()
    await session.refresh(card)
    return Envelope(data=KanbanCardOut.model_validate(card))


@router.put("/cards/{card_id}", response_model=Envelope[KanbanCardOut])
async def update_card(
    card_id: int,
    payload: KanbanCardUpdate,
    session: AsyncSession = Depends(get_session),
) -> Envelope[KanbanCardOut]:
    card = await session.get(KanbanCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    if payload.column is not None:
        _validate_column(payload.column)
        card.column = payload.column
    if payload.position is not None:
        card.position = payload.position
    if payload.title is not None:
        card.title = payload.title
    if payload.description is not None:
        card.description = payload.description
    if payload.due_date is not None:
        card.due_date = payload.due_date

    await session.commit()
    await session.refresh(card)
    return Envelope(data=KanbanCardOut.model_validate(card))


@router.delete("/cards/{card_id}", response_model=Envelope[dict])
async def delete_card(
    card_id: int,
    session: AsyncSession = Depends(get_session),
) -> Envelope[dict]:
    card = await session.get(KanbanCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    await session.delete(card)
    await session.commit()
    return Envelope(data={"deleted": card_id})
