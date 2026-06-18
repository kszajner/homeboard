"""Fetch, parse, and cache iCloud .ics calendars."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx
import recurring_ical_events
from icalendar import Calendar
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from backend.config import get_settings
from backend.database import AsyncSessionLocal
from backend.models import CachedEvent

logger = logging.getLogger(__name__)


# Window of recurring-event instances to materialize on each fetch.
EXPANSION_DAYS_PAST = 60
EXPANSION_DAYS_FUTURE = 365


@dataclass
class CalendarFetchResult:
    url: str
    calendar_name: str
    ok: bool
    events_count: int = 0
    error: str | None = None


@dataclass
class IcalState:
    last_refresh_at: datetime | None = None
    last_success_at: datetime | None = None
    is_stale: bool = False
    last_errors: list[str] = field(default_factory=list)
    calendars: list[CalendarFetchResult] = field(default_factory=list)


# Module-level mutable state — single-user app, no concurrency concerns.
state = IcalState()


def _normalize_url(url: str) -> str:
    """Rewrite webcal:// to https:// (iCloud publishes both)."""
    if url.startswith("webcal://"):
        return "https://" + url[len("webcal://") :]
    return url


def _to_utc_naive(value: datetime | date) -> tuple[datetime, bool]:
    """Convert an icalendar value to a naive UTC datetime.

    Returns (datetime_utc, all_day).
    """
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value, False
    # plain date → all-day
    return datetime(value.year, value.month, value.day), True


async def _fetch_ics(url: str) -> str:
    real_url = _normalize_url(url)
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(real_url, headers={"User-Agent": "home-dashboard/1.0"})
        response.raise_for_status()
        return response.text


def _calendar_name(cal: Calendar, fallback: str) -> str:
    name = cal.get("X-WR-CALNAME") or cal.get("NAME")
    if name:
        return str(name).strip()
    return fallback


def _parse_events(ics_text: str, fallback_name: str) -> tuple[str, list[dict[str, Any]]]:
    cal = Calendar.from_ical(ics_text)
    calendar_name = _calendar_name(cal, fallback_name)

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=EXPANSION_DAYS_PAST)
    window_end = now + timedelta(days=EXPANSION_DAYS_FUTURE)

    expanded = recurring_ical_events.of(cal).between(window_start, window_end)

    events: list[dict[str, Any]] = []
    for component in expanded:
        if component.name != "VEVENT":
            continue
        try:
            raw_start = component.get("DTSTART").dt
            raw_end_prop = component.get("DTEND")
            raw_end = raw_end_prop.dt if raw_end_prop else raw_start

            start_dt, all_day_start = _to_utc_naive(raw_start)
            end_dt, all_day_end = _to_utc_naive(raw_end)
            all_day = all_day_start or all_day_end

            # iCal DTEND for all-day events is exclusive (DTEND=22 June means
            # the event lasts through 21 June). Make it inclusive so the
            # frontend's day-range loop doesn't paint an extra day.
            if all_day and end_dt > start_dt:
                end_dt = end_dt - timedelta(days=1)

            uid = str(component.get("UID") or f"no-uid-{start_dt.isoformat()}")
            title = str(component.get("SUMMARY") or "(bez tytułu)")
            description = component.get("DESCRIPTION")
            location = component.get("LOCATION")

            events.append(
                {
                    "uid": uid[:500],
                    "calendar_name": calendar_name[:200],
                    "title": title[:500],
                    "description": str(description) if description else None,
                    "location": str(location)[:500] if location else None,
                    "start": start_dt,
                    "end": end_dt,
                    "all_day": all_day,
                }
            )
        except Exception:  # noqa: BLE001
            logger.exception("Failed to parse a VEVENT in %s", calendar_name)

    return calendar_name, events


async def _upsert_events(calendar_name: str, events: list[dict[str, Any]]) -> None:
    if not events:
        return
    now = datetime.utcnow()
    async with AsyncSessionLocal() as session:
        for ev in events:
            ev["fetched_at"] = now
            stmt = sqlite_insert(CachedEvent).values(**ev)
            stmt = stmt.on_conflict_do_update(
                index_elements=["uid", "calendar_name", "start"],
                set_={
                    "title": ev["title"],
                    "description": ev["description"],
                    "location": ev["location"],
                    "end": ev["end"],
                    "all_day": ev["all_day"],
                    "fetched_at": now,
                },
            )
            await session.execute(stmt)
        await session.commit()


async def refresh_one(url: str) -> CalendarFetchResult:
    fallback = url.rsplit("/", 1)[-1] or url
    try:
        ics_text = await _fetch_ics(url)
        calendar_name, events = _parse_events(ics_text, fallback_name=fallback)
        await _upsert_events(calendar_name, events)
        logger.info("Refreshed calendar %s (%d events)", calendar_name, len(events))
        return CalendarFetchResult(
            url=url, calendar_name=calendar_name, ok=True, events_count=len(events)
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to refresh %s: %s", url, exc)
        return CalendarFetchResult(
            url=url, calendar_name=fallback, ok=False, error=str(exc)
        )


async def refresh_all() -> IcalState:
    settings = get_settings()
    urls = settings.ical_urls

    state.last_refresh_at = datetime.utcnow()

    if not urls:
        state.is_stale = False
        state.last_errors = []
        state.calendars = []
        logger.info("No ICAL_URL_* configured; skipping calendar refresh")
        return state

    results: list[CalendarFetchResult] = []
    for url in urls:
        results.append(await refresh_one(url))

    state.calendars = results
    errors = [f"{r.calendar_name}: {r.error}" for r in results if not r.ok and r.error]
    state.last_errors = errors

    any_ok = any(r.ok for r in results)
    all_ok = all(r.ok for r in results)
    if any_ok:
        state.last_success_at = datetime.utcnow()
    # Stale if any URL failed but we still have prior cached data.
    state.is_stale = not all_ok

    return state


async def events_in_range(start: datetime, end: datetime) -> list[CachedEvent]:
    async with AsyncSessionLocal() as session:
        stmt = (
            select(CachedEvent)
            .where(CachedEvent.end >= start, CachedEvent.start <= end)
            .order_by(CachedEvent.start)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
