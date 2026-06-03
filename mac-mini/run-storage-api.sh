#!/bin/bash
# Mac Mini only — SQLite REST API for Vercel (behind Cloudflare Tunnel).
# Install: chmod +x mac-mini/run-storage-api.sh

set -euo pipefail

REPO="${WEB_DIALER_REPO:-$HOME/website-selling}"
cd "$REPO"

if [[ ! -d scraper/.venv ]]; then
  cd scraper
  python3 -m venv .venv
  cd ..
fi
# shellcheck disable=SC1091
source scraper/.venv/bin/activate
pip install -q -r scraper/requirements.txt -r storage/requirements.txt

export STORAGE_DB_PATH="${STORAGE_DB_PATH:-$HOME/.web-dialer/dialer.db}"
mkdir -p "$(dirname "$STORAGE_DB_PATH")"

exec python storage/api_server.py
