"""FastAPI entry point for the Home Dashboard."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from backend.config import get_settings
from backend.database import AsyncSessionLocal, engine
from backend.routes import bills as bills_routes
from backend.routes import calendar as calendar_routes
from backend.routes import kanban as kanban_routes
from backend.routes import menu as menu_routes
from backend.routes import weather as weather_routes
from backend.scheduler import shutdown_scheduler, start_scheduler
from backend.services import ical

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


def _run_migrations() -> None:
    """Run Alembic migrations to head on startup."""
    from alembic import command
    from alembic.config import Config

    ini_path = Path(__file__).parent / "alembic.ini"
    cfg = Config(str(ini_path))
    cfg.set_main_option("script_location", str(ini_path.parent / "alembic"))
    logger.info("Running Alembic migrations to head")
    command.upgrade(cfg, "head")


async def _initial_refresh() -> None:
    try:
        await ical.refresh_all()
    except Exception:  # noqa: BLE001
        logger.exception("Initial calendar refresh failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path("data").mkdir(parents=True, exist_ok=True)
    try:
        # Alembic env.py uses asyncio.run() internally; run it in a worker
        # thread so it does not collide with the already-running event loop.
        await asyncio.to_thread(_run_migrations)
    except Exception:  # noqa: BLE001
        logger.exception("Alembic migration failed; continuing startup")

    logger.info(
        "Starting %s in %s mode on :%d",
        settings.app_name,
        settings.app_env,
        settings.port,
    )

    start_scheduler()
    # Fire-and-forget initial refresh so app startup is not blocked by
    # iCloud network latency.
    asyncio.create_task(_initial_refresh())

    yield

    await shutdown_scheduler()
    await engine.dispose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.include_router(calendar_routes.router)
app.include_router(weather_routes.router)
app.include_router(bills_routes.router)
app.include_router(kanban_routes.router)
app.include_router(menu_routes.router)


# --- Frontend static files ---
# Each sub-directory of /frontend is mounted separately so /index.html stays
# at the root and the SPA can refer to /css/..., /js/..., /assets/... directly.
if FRONTEND_DIR.exists():
    for sub in ("css", "js", "assets"):
        path = FRONTEND_DIR / sub
        if path.exists():
            app.mount(f"/{sub}", StaticFiles(directory=path), name=sub)

    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/manifest.json")
    async def manifest() -> FileResponse:
        manifest_path = FRONTEND_DIR / "manifest.json"
        if manifest_path.exists():
            return FileResponse(manifest_path)
        return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/health")
async def health() -> dict[str, object]:
    db_ok = False
    db_error: str | None = None
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception as exc:  # noqa: BLE001
        db_error = str(exc)
        logger.warning("DB health check failed: %s", exc)

    return {
        "status": "ok" if db_ok else "degraded",
        "database": "ok" if db_ok else f"error: {db_error}",
    }
