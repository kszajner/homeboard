"""Kanban CRUD endpoints — single board, three fixed columns, with subtasks."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import get_session
from backend.models import KanbanCard, KanbanSubtask
from backend.schemas import (
    Envelope,
    KANBAN_COLUMNS,
    KanbanCardCreate,
    KanbanCardOut,
    KanbanCardUpdate,
    KanbanSubtaskCreate,
    KanbanSubtaskOut,
    KanbanSubtaskUpdate,
)

router = APIRouter(prefix="/api/kanban", tags=["kanban"])


def _validate_column(column: str) -> None:
    if column not in KANBAN_COLUMNS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid column: {column}. Must be one of {list(KANBAN_COLUMNS)}",
        )


async def _load_card(session: AsyncSession, card_id: int) -> KanbanCard:
    stmt = (
        select(KanbanCard)
        .where(KanbanCard.id == card_id)
        .options(selectinload(KanbanCard.subtasks))
    )
    result = await session.execute(stmt)
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.get("/cards", response_model=Envelope[list[KanbanCardOut]])
async def list_cards(
    session: AsyncSession = Depends(get_session),
) -> Envelope[list[KanbanCardOut]]:
    stmt = (
        select(KanbanCard)
        .options(selectinload(KanbanCard.subtasks))
        .order_by(KanbanCard.column, KanbanCard.position)
    )
    result = await session.execute(stmt)
    cards = result.scalars().all()
    return Envelope(data=[KanbanCardOut.model_validate(c) for c in cards])


@router.post("/cards", response_model=Envelope[KanbanCardOut])
async def create_card(
    payload: KanbanCardCreate,
    session: AsyncSession = Depends(get_session),
) -> Envelope[KanbanCardOut]:
    _validate_column(payload.column)
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
    return Envelope(data=KanbanCardOut.model_validate(await _load_card(session, card.id)))


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
    return Envelope(data=KanbanCardOut.model_validate(await _load_card(session, card.id)))


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


# --- Subtasks ---


@router.post("/cards/{card_id}/subtasks", response_model=Envelope[KanbanSubtaskOut])
async def create_subtask(
    card_id: int,
    payload: KanbanSubtaskCreate,
    session: AsyncSession = Depends(get_session),
) -> Envelope[KanbanSubtaskOut]:
    card = await session.get(KanbanCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    last_position_stmt = (
        select(KanbanSubtask.position)
        .where(KanbanSubtask.card_id == card_id)
        .order_by(KanbanSubtask.position.desc())
        .limit(1)
    )
    last = (await session.execute(last_position_stmt)).scalar_one_or_none()
    next_position = (last or 0) + 1

    subtask = KanbanSubtask(
        card_id=card_id,
        title=payload.title,
        position=next_position,
    )
    session.add(subtask)
    await session.commit()
    await session.refresh(subtask)
    return Envelope(data=KanbanSubtaskOut.model_validate(subtask))


@router.put("/subtasks/{subtask_id}", response_model=Envelope[KanbanSubtaskOut])
async def update_subtask(
    subtask_id: int,
    payload: KanbanSubtaskUpdate,
    session: AsyncSession = Depends(get_session),
) -> Envelope[KanbanSubtaskOut]:
    subtask = await session.get(KanbanSubtask, subtask_id)
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")

    if payload.title is not None:
        subtask.title = payload.title
    if payload.done is not None:
        subtask.done = payload.done
    if payload.position is not None:
        subtask.position = payload.position

    await session.commit()
    await session.refresh(subtask)
    return Envelope(data=KanbanSubtaskOut.model_validate(subtask))


@router.delete("/subtasks/{subtask_id}", response_model=Envelope[dict])
async def delete_subtask(
    subtask_id: int,
    session: AsyncSession = Depends(get_session),
) -> Envelope[dict]:
    subtask = await session.get(KanbanSubtask, subtask_id)
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    await session.delete(subtask)
    await session.commit()
    return Envelope(data={"deleted": subtask_id})
