#!/bin/bash
# Mac Mini only — pull latest code and run smart lead scraper.
# Install: chmod +x mac-mini/run-scraper.sh
# launchd: StartInterval 3600, ProgramArguments → this script

set -euo pipefail

REPO="${WEB_DIALER_REPO:-$HOME/website-selling}"
cd "$REPO"
git pull --rebase

cd scraper
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt
python headless_scraper.py
