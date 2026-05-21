#!/usr/bin/env bash
# Deploy the dashboard to the Raspberry Pi via rsync + ssh.
#
# Defaults assume the RPI is reachable at 192.168.1.32 over SSH and that the
# project lives at /mnt/ssd/docker/dashboard/. Override with env vars:
#   RPI_HOST=pi@dashboard.local RPI_PATH=/srv/dashboard bash scripts/deploy-rpi.sh

set -euo pipefail

RPI_HOST="${RPI_HOST:-pi@192.168.1.32}"
RPI_PATH="${RPI_PATH:-/mnt/ssd/docker/dashboard}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "Deploying to ${RPI_HOST}:${RPI_PATH}"

# Ensure target directory exists.
ssh "$RPI_HOST" "mkdir -p '$RPI_PATH'"

# Sync project files. Excludes mirror .gitignore.
rsync -avz --delete \
  --exclude '.git/' \
  --exclude '.venv/' \
  --exclude 'data/' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.ruff_cache/' \
  --exclude '.pytest_cache/' \
  --exclude '.mypy_cache/' \
  --exclude '.idea/' \
  --exclude '.vscode/' \
  ./ "${RPI_HOST}:${RPI_PATH}/"

echo "Rebuilding and restarting on the RPI…"
ssh "$RPI_HOST" "cd '$RPI_PATH' && docker compose up -d --build"

echo "Deploy complete. Dashboard should be reachable at http://192.168.1.32:8089"
