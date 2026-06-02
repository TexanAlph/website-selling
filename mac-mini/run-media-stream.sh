#!/bin/bash
# Mac Mini only — Twilio Media Streams WebSocket receiver (prospect vs rep STT).
set -euo pipefail

REPO="${WEB_DIALER_REPO:-$HOME/website-selling}"
cd "$REPO" && git pull --ff-only

cd scraper
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt
exec python media_stream_server.py
