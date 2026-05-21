# Home Dashboard

Self-hosted home dashboard for a wall-mounted tablet. Aggregates iCloud
calendars, tracks bills, runs a simple Kanban board, plans the weekly menu,
and shows local weather. Designed for single-user use on a trusted LAN
(LAN or WireGuard VPN access only — no authentication).

> **Status:** MVP. Built iteratively in 10 stages — see `CLAUDE.md`.

## Features

- **Monthly calendar** aggregating multiple iCloud `.ics` URLs, with offline
  caching (events persist if iCloud is unreachable).
- **Bills tracker** — one-time, recurring, and subscription bills. Marking a
  recurring bill as paid automatically creates the next month's instance.
- **Kanban** — a single global board (To do / In progress / Done) with
  drag-and-drop (SortableJS, touch-friendly).
- **Weekly menu planner** — 7 day cards with autosaved lunch + notes.
- **Weather widget** — current conditions for Sopot via Open-Meteo (no API key).

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2 (async) + SQLite, Alembic,
  APScheduler, httpx, icalendar.
- **Frontend:** Vanilla JavaScript (ES modules), CSS custom properties, Inter
  font self-hosted.
- **Deployment:** Docker Compose on Raspberry Pi 5 (Debian 13).

## Quick start (development)

```bash
cp .env.example .env
# fill in ICAL_URL_1, ICAL_URL_2 ... if you have iCloud calendars
make dev
```

Open <http://localhost:8089>.

Useful endpoints while developing:

- `GET /api/health` — liveness + DB check
- `GET /api/calendar/status` — last refresh / staleness info
- `POST /api/calendar/refresh` — force a calendar refresh

## Configuration

All configuration lives in `.env` (see `.env.example`):

| Variable               | Default               | Notes                                     |
| ---------------------- | --------------------- | ----------------------------------------- |
| `APP_ENV`              | `development`         | `development` / `production`              |
| `LOG_LEVEL`            | `INFO`                | Standard Python log levels                |
| `WEATHER_LAT`          | `54.4418`             | Sopot                                     |
| `WEATHER_LON`          | `18.5601`             |                                           |
| `WEATHER_CITY`         | `Sopot`               | Display label only                        |
| `ICAL_URL_1`, `_2`, …  | —                     | Any var with the `ICAL_URL_` prefix works |

`webcal://` URLs are accepted and rewritten to `https://`.

## Deployment to Raspberry Pi

The project is intended for a single RPI (port `8089`).

```bash
# from the dev machine
make deploy-rpi
```

The script `scripts/deploy-rpi.sh` rsyncs the repo, then runs
`docker compose up -d --build` over SSH. Override `RPI_HOST` and `RPI_PATH`
env vars if your setup differs:

```bash
RPI_HOST=pi@dashboard.local RPI_PATH=/srv/dashboard make deploy-rpi
```

## Backups

`scripts/backup.sh` produces a timestamped `dashboard-YYYYMMDD-HHMM.tar.gz`
containing the SQLite DB and `.env`, and keeps the 7 most recent in
`data/backups/`. Run it from the host (not inside the container).

Example crontab entry (daily at 03:00):

```
0 3 * * * cd /mnt/ssd/docker/dashboard && bash scripts/backup.sh >> data/backups/backup.log 2>&1
```

Restore:

```bash
make restore file=data/backups/dashboard-20260521-0300.tar.gz
```

## Project layout

```
dashboard/
├── backend/                 # FastAPI app + SQLAlchemy models
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── scheduler.py         # APScheduler — refreshes iCloud hourly
│   ├── routes/              # API endpoints
│   ├── services/            # iCloud + weather clients
│   └── alembic/             # Schema migrations
├── frontend/                # Vanilla JS + CSS, no build step
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
├── scripts/                 # backup, restore, deploy
├── docker-compose.yml       # production
├── docker-compose.dev.yml   # development (volume mounts + reload)
├── Dockerfile
└── Makefile
```

## Make targets

| Target               | What it does                                      |
| -------------------- | ------------------------------------------------- |
| `make dev`           | Run with hot-reload via `docker-compose.dev.yml`  |
| `make logs`          | Tail container logs                               |
| `make shell`         | Open a shell inside the dev container             |
| `make down`          | Stop the dev stack                                |
| `make build`         | Build the production image                        |
| `make migrate`       | Run `alembic upgrade head` inside the container   |
| `make migration name="..."` | Generate a new Alembic revision           |
| `make backup`        | Run `scripts/backup.sh`                           |
| `make restore file=…`| Run `scripts/restore.sh` with the given archive   |
| `make deploy-rpi`    | rsync + remote `docker compose up -d --build`     |

## License

MIT — see [`LICENSE`](LICENSE).
