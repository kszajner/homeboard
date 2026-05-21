#!/usr/bin/env bash
# Backup the SQLite database and .env into a timestamped tar.gz.
# Keeps the 7 most recent backups; older ones are deleted.
#
# Run from a host-side cron, NOT from inside the container.
# Example crontab entry (daily at 03:00):
#   0 3 * * * cd /mnt/ssd/docker/dashboard && bash scripts/backup.sh >> data/backups/backup.log 2>&1

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

DB_FILE="data/dashboard.db"
ENV_FILE=".env"
BACKUP_DIR="data/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M)"
TMP_DIR="$(mktemp -d)"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ]; then
  echo "Database file not found: $DB_FILE" >&2
  exit 1
fi

# Use sqlite3 .backup for a consistent online copy.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '$TMP_DIR/dashboard.db'"
else
  echo "sqlite3 not installed; falling back to file copy (may be inconsistent if app is writing)" >&2
  cp "$DB_FILE" "$TMP_DIR/dashboard.db"
fi

if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$TMP_DIR/.env"
fi

ARCHIVE="$BACKUP_DIR/dashboard-$TIMESTAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$TMP_DIR" .
rm -rf "$TMP_DIR"

echo "Backup created: $ARCHIVE"

# Rotation — keep the 7 most recent.
ls -1t "$BACKUP_DIR"/dashboard-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
