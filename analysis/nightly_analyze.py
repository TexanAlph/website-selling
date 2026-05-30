#!/usr/bin/env python3
"""
Nightly call analysis — run on Mac Mini via launchd (see docs/MACHINES.md).

Triggers the dialer's batch endpoint (same logic as Vercel cron):
  - Post-call AI swarm for any sessions still pending
  - Daily insights report + playbook candidates

Env (analysis/.env or scraper/.env):
  DIALER_URL=https://your-dialer.vercel.app
  CRON_SECRET=long-random-string  (same as Vercel CRON_SECRET)
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

for path in (
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parent.parent / "scraper" / ".env",
):
    if path.exists():
        load_dotenv(path)
        break

LOG = logging.getLogger("nightly_analyze")


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [ANALYZE] %(message)s",
    )

    base = os.getenv("DIALER_URL", "").strip().rstrip("/")
    secret = os.getenv("CRON_SECRET", "").strip()

    if not base or not secret:
        LOG.error("Set DIALER_URL and CRON_SECRET")
        sys.exit(1)

    url = f"{base}/api/cron/analyze"
    r = requests.post(
        url,
        headers={"Authorization": f"Bearer {secret}"},
        timeout=180,
    )

    if not r.ok:
        LOG.error("Batch failed %s: %s", r.status_code, r.text[:500])
        sys.exit(1)

    LOG.info("OK: %s", r.json())


if __name__ == "__main__":
    main()
