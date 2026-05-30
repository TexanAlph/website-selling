#!/usr/bin/env python3
"""
Headless lead scraper — run on Mac Mini only, not MacBook Air (see docs/MACHINES.md).
Scheduled via launchd/cron on the Mini.

- Queries Google Places API for local service businesses without websites
- Upserts into Supabase `leads` with phone UNIQUE deduplication

Required env (see scraper/.env.example):
  GOOGLE_MAPS_API_KEY
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import json
import logging
import os
import random
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).resolve().parent / ".env")

LOG = logging.getLogger("headless_scraper")

# --- Search configuration (rotate daily through the full matrix) ---

NICHES = [
    "roofing contractor",
    "HVAC contractor",
    "plumber",
    "electrician",
    "landscaping",
    "pest control",
    "garage door repair",
    "fence company",
    "pressure washing",
    "pool service",
    "cleaning service",
    "auto repair",
    "auto detailing",
    "barbershop",
    "nail salon",
    "tattoo shop",
]

AREAS = [
    "San Antonio Texas",
    "North San Antonio Texas",
    "Stone Oak San Antonio Texas",
    "Alamo Heights San Antonio Texas",
    "Converse Texas",
    "Schertz Texas",
    "Universal City Texas",
    "Helotes Texas",
]

SEARCHES_PER_RUN = int(os.getenv("SEARCHES_PER_RUN", "80"))
DETAILS_WORKERS = int(os.getenv("DETAILS_WORKERS", "6"))
SEARCH_WORKERS = int(os.getenv("SEARCH_WORKERS", "6"))
SEARCH_CACHE_TTL_DAYS = int(os.getenv("SEARCH_CACHE_TTL_DAYS", "7"))

CACHE_DIR = Path(os.getenv("SCRAPER_CACHE_DIR", Path.home() / ".web-dialer"))
SEARCH_CACHE_FILE = CACHE_DIR / "search_cache.json"
SEEN_PLACE_IDS_FILE = CACHE_DIR / "seen_place_ids.json"

PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


@dataclass
class LeadRow:
    business_name: str
    phone: str
    website: str | None
    niche: str
    status: str = "New"


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        LOG.error("Missing required env var: %s", name)
        sys.exit(1)
    return value


def normalize_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return None


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return default


def save_json(path: Path, data: Any) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f)


def search_cache_valid(cache: dict, query: str) -> bool:
    entry = cache.get(query)
    if not entry:
        return False
    fetched = datetime.strptime(entry["fetched"], "%Y-%m-%d").date()
    return (date.today() - fetched) < timedelta(days=SEARCH_CACHE_TTL_DAYS)


def places_text_search(api_key: str, query: str) -> list[dict]:
    params = {"query": query, "key": api_key}
    place_ids: list[str] = []
    next_page: str | None = None

    for _ in range(3):  # max 3 pages (60 results)
        if next_page:
            params = {"pagetoken": next_page, "key": api_key}
            time.sleep(2)  # Google requires delay before next_page_token is valid

        r = requests.get(PLACES_TEXT_SEARCH_URL, params=params, timeout=30)
        r.raise_for_status()
        payload = r.json()
        status = payload.get("status")
        if status not in ("OK", "ZERO_RESULTS"):
            raise RuntimeError(f"Places text search failed: {status} ({payload.get('error_message')})")

        for result in payload.get("results", []):
            pid = result.get("place_id")
            if pid:
                place_ids.append(pid)

        next_page = payload.get("next_page_token")
        if not next_page:
            break

    return [{"place_id": pid} for pid in place_ids]


def places_details(api_key: str, place_id: str) -> dict:
    params = {
        "place_id": place_id,
        "fields": "name,formatted_phone_number,international_phone_number,website,"
        "business_status,formatted_address,rating,user_ratings_total,types",
        "key": api_key,
    }
    r = requests.get(PLACES_DETAILS_URL, params=params, timeout=30)
    r.raise_for_status()
    payload = r.json()
    if payload.get("status") != "OK":
        return {}
    return payload.get("result", {})


def texas_address(address: str) -> bool:
    if not address:
        return True
    return bool(re.search(r"\bTX\b|\bTexas\b", address, re.IGNORECASE))


def run_search(
    api_key: str,
    query: str,
    search_cache: dict,
    today: str,
) -> tuple[str, list[dict], bool]:
    """Returns (query, places, api_called)."""
    if search_cache_valid(search_cache, query):
        ids = search_cache[query]["place_ids"]
        return query, [{"place_id": pid} for pid in ids], False

    places = places_text_search(api_key, query)
    search_cache[query] = {
        "fetched": today,
        "place_ids": [p["place_id"] for p in places if p.get("place_id")],
    }
    return query, places, True


def lead_from_details(place_id: str, query: str, details: dict) -> LeadRow | None:
    if not details:
        return None
    if details.get("business_status") == "CLOSED_PERMANENTLY":
        return None
    if details.get("website"):
        return None

    name = (details.get("name") or "").strip()
    if not name:
        return None

    phone = normalize_phone(
        details.get("formatted_phone_number")
        or details.get("international_phone_number")
    )
    if not phone:
        return None

    address = details.get("formatted_address", "")
    if not texas_address(address):
        return None

    niche = query
    for area in AREAS:
        if area.lower() in query.lower():
            niche = query.replace(area, "").strip()
            break

    return LeadRow(
        business_name=name,
        phone=phone,
        website=None,
        niche=niche or "local service",
    )


def upsert_leads(supabase: Client, rows: list[LeadRow]) -> int:
    if not rows:
        return 0

    payload = [
        {
            "business_name": row.business_name,
            "phone": row.phone,
            "website": row.website,
            "niche": row.niche,
            "status": row.status,
        }
        for row in rows
    ]

    supabase.table("leads").upsert(
        payload,
        on_conflict="phone",
        ignore_duplicates=False,
    ).execute()
    return len(payload)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [SCRAPER] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    api_key = require_env("GOOGLE_MAPS_API_KEY")
    supabase_url = require_env("SUPABASE_URL")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")

    supabase = create_client(supabase_url, service_key)
    today = str(date.today())

    search_cache = load_json(SEARCH_CACHE_FILE, {})
    seen_ids = set(load_json(SEEN_PLACE_IDS_FILE, []))

    all_queries = [f"{niche} {area}" for niche in NICHES for area in AREAS]
    rng = random.Random(date.today().toordinal())
    rng.shuffle(all_queries)
    queries = all_queries[:SEARCHES_PER_RUN]

    LOG.info("Running %d searches (TTL %dd)...", len(queries), SEARCH_CACHE_TTL_DAYS)

    candidates: list[tuple[str, str]] = []
    seen_this_run: set[str] = set()
    search_api_calls = 0
    search_cache_hits = 0

    with ThreadPoolExecutor(max_workers=SEARCH_WORKERS) as pool:
        futures = {
            pool.submit(run_search, api_key, q, search_cache, today): q for q in queries
        }
        for future in as_completed(futures):
            query, places, api_called = future.result()
            if api_called:
                search_api_calls += 1
            else:
                search_cache_hits += 1
            for place in places:
                pid = place.get("place_id")
                if pid and pid not in seen_ids and pid not in seen_this_run:
                    seen_this_run.add(pid)
                    candidates.append((pid, query))

    LOG.info(
        "Search API: %d | cache hits: %d | new candidates: %d",
        search_api_calls,
        search_cache_hits,
        len(candidates),
    )

    new_leads: list[LeadRow] = []

    def check(pid_query: tuple[str, str]) -> LeadRow | None:
        pid, query = pid_query
        details = places_details(api_key, pid)
        return lead_from_details(pid, query, details)

    with ThreadPoolExecutor(max_workers=DETAILS_WORKERS) as pool:
        for lead in pool.map(check, candidates):
            if lead:
                new_leads.append(lead)
                LOG.info("✓ %s | %s", lead.business_name, lead.phone)

    inserted = upsert_leads(supabase, new_leads)

    seen_ids.update(seen_this_run)
    save_json(SEEN_PLACE_IDS_FILE, list(seen_ids))
    save_json(SEARCH_CACHE_FILE, search_cache)

    LOG.info("Done. Upserted %d leads.", inserted)


if __name__ == "__main__":
    main()
