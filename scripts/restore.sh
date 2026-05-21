#!/usr/bin/env bash
# Restore a backup created by scripts/backup.sh.
# Usage: bash scripts/restore.sh data/backups/dashboard-YYYYMMDD-HHMM.tar.gz

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup.tar.gz>" >&2
  exit 1
fi

ARCHIVE="$1"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -f "$ARCHIVE" ]; then
  echo "Archive not found: $ARCHIVE" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
tar -xzf "$ARCHIVE" -C "$TMP_DIR"

echo "Stopping dashboard container (if running)…"
docker compose down || true

if [ -f "$TMP_DIR/dashboard.db" ]; then
  mkdir -p data
  cp "$TMP_DIR/dashboard.db" data/dashboard.db
  echo "Restored data/dashboard.db"
fi

if [ -f "$TMP_DIR/.env" ]; then
  cp "$TMP_DIR/.env" .env
  echo "Restored .env"
fi

rm -rf "$TMP_DIR"

echo "Starting dashboard container…"
docker compose up -d
