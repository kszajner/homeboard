"""Weather API route."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from backend.schemas import Envelope
from backend.services import weather as weather_service

router = APIRouter(prefix="/api", tags=["weather"])


@router.get("/weather", response_model=Envelope[dict[str, Any]])
async def current_weather() -> Envelope[dict[str, Any]]:
    try:
        data = await weather_service.get_weather()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return Envelope(data=data)
