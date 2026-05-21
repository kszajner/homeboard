"""Background scheduler — refreshes iCloud calendars every hour."""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from backend.services import ical

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _refresh_job() -> None:
    try:
        await ical.refresh_all()
    except Exception:  # noqa: BLE001
        logger.exception("Calendar refresh job raised")


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    scheduler = AsyncIOScheduler(timezone="Europe/Warsaw")
    scheduler.add_job(
        _refresh_job,
        trigger=IntervalTrigger(hours=1),
        id="ical_refresh",
        name="Refresh iCloud calendars",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info("Scheduler started; ical_refresh runs every 1h")
    return scheduler


async def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Scheduler stopped")
