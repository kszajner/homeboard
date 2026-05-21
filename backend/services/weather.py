"""OpenMeteo weather client — in-memory cache, ~30 minute TTL."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import httpx

from backend.config import get_settings

logger = logging.getLogger(__name__)

CACHE_TTL = timedelta(minutes=30)

_cache: dict[str, Any] | None = None
_cache_at: datetime | None = None


# Open-Meteo WMO weather codes → (slug, polish label)
WMO_MAP: dict[int, tuple[str, str]] = {
    0: ("clear", "bezchmurnie"),
    1: ("mostly-clear", "głównie bezchmurnie"),
    2: ("partly-cloudy", "częściowe zachmurzenie"),
    3: ("cloudy", "pochmurno"),
    45: ("fog", "mgła"),
    48: ("fog", "szadź"),
    51: ("drizzle", "lekka mżawka"),
    53: ("drizzle", "mżawka"),
    55: ("drizzle", "gęsta mżawka"),
    61: ("rain", "lekki deszcz"),
    63: ("rain", "deszcz"),
    65: ("rain", "ulewny deszcz"),
    66: ("rain", "marznący deszcz"),
    67: ("rain", "marznący deszcz"),
    71: ("snow", "lekki śnieg"),
    73: ("snow", "śnieg"),
    75: ("snow", "gęsty śnieg"),
    77: ("snow", "ziarna śniegu"),
    80: ("rain", "przelotny deszcz"),
    81: ("rain", "przelotny deszcz"),
    82: ("rain", "ulewny deszcz"),
    85: ("snow", "przelotny śnieg"),
    86: ("snow", "przelotny śnieg"),
    95: ("thunderstorm", "burza"),
    96: ("thunderstorm", "burza z gradem"),
    99: ("thunderstorm", "burza z gradem"),
}


def _describe(code: int) -> tuple[str, str]:
    return WMO_MAP.get(code, ("unknown", "nieznane"))


async def get_weather(force: bool = False) -> dict[str, Any]:
    global _cache, _cache_at
    now = datetime.utcnow()
    if not force and _cache is not None and _cache_at and (now - _cache_at) < CACHE_TTL:
        return _cache

    settings = get_settings()
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": settings.weather_lat,
        "longitude": settings.weather_lon,
        "current": "temperature_2m,weather_code,wind_speed_10m",
        "timezone": "Europe/Warsaw",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()

        current = payload.get("current") or {}
        code = int(current.get("weather_code", -1))
        slug, label = _describe(code)
        data = {
            "city": settings.weather_city,
            "temperature": current.get("temperature_2m"),
            "wind_speed": current.get("wind_speed_10m"),
            "weather_code": code,
            "icon": slug,
            "description": label,
            "fetched_at": now.isoformat() + "Z",
        }
        _cache = data
        _cache_at = now
        return data
    except Exception as exc:  # noqa: BLE001
        logger.warning("Weather fetch failed: %s", exc)
        if _cache is not None:
            return _cache
        raise
