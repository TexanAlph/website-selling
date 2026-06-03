#!/usr/bin/env python3
"""
Headless lead scraper — run on Mac Mini only, not MacBook Air (see docs/MACHINES.md).
Scheduled via launchd/cron on the Mini.

- Queries Google Places API for local service businesses without websites
- Upserts into Mac Mini SQLite (`~/.web-dialer/dialer.db`) with phone UNIQUE dedup

Required env (see scraper/.env.example):
  GOOGLE_MAPS_API_KEY
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

from places_cost import estimate_usd, explain_for_log

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "storage"))
import local_db as db  # noqa: E402

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

DEFAULT_SEARCHES_PER_RUN = 40
SEARCHES_PER_RUN = int(os.getenv("SEARCHES_PER_RUN", str(DEFAULT_SEARCHES_PER_RUN)))
TEXT_SEARCH_MAX_PAGES = 1
MAX_DETAILS_PER_RUN = 20  # fallback only — most leads come from search data directly
REPS = ("david", "x")
MAX_NEW_PER_REP = 100

DETAILS_WORKERS = int(os.getenv("DETAILS_WORKERS", "6"))
SEARCH_WORKERS = int(os.getenv("SEARCH_WORKERS", "6"))
SEARCH_CACHE_TTL_DAYS = int(os.getenv("SEARCH_CACHE_TTL_DAYS", "14"))

CACHE_DIR = Path(os.getenv("SCRAPER_CACHE_DIR", Path.home() / ".web-dialer"))
SEARCH_CACHE_FILE = CACHE_DIR / "search_cache.json"
SEEN_PLACE_IDS_FILE = CACHE_DIR / "seen_place_ids.json"

PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places"

# Text Search fetches all fields we need to build a lead — websiteUri lets us
# pre-filter businesses with websites before ever calling Place Details.
# This upgrades Text Search from Basic → Advanced SKU ($32→$35/1000) but
# eliminates ~90% of Details calls ($20/1000 each), a large net saving.
TEXT_SEARCH_FIELD_MASK = (
    "places.id,places.websiteUri,places.nationalPhoneNumber,"
    "places.displayName,places.formattedAddress,places.businessStatus,"
    "nextPageToken"
)


@dataclass
class LeadRow:
    business_name: str
    phone: str
    website: str | None
    niche: str
    assigned_rep: str
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


def places_text_search(api_key: str, query: str) -> tuple[list[dict], int]:
    """Returns (places, billable HTTP calls). Each place includes key lead fields."""
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK,
        "Content-Type": "application/json",
    }
    places: list[dict] = []
    page_token: str | None = None
    http_calls = 0

    for _ in range(TEXT_SEARCH_MAX_PAGES):
        body: dict = {"textQuery": query}
        if page_token:
            body["pageToken"] = page_token

        http_calls += 1
        r = requests.post(PLACES_TEXT_SEARCH_URL, json=body, headers=headers, timeout=30)
        r.raise_for_status()
        payload = r.json()

        for place in payload.get("places", []):
            if place.get("id"):
                places.append(place)

        page_token = payload.get("nextPageToken")
        if not page_token:
            break

    return places, http_calls


def places_details(api_key: str, place_id: str) -> dict:
    """Fallback for candidates missing phone or name in the Text Search result."""
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
            "displayName,nationalPhoneNumber,websiteUri,businessStatus,formattedAddress"
        ),
    }
    r = requests.get(f"{PLACES_DETAILS_URL}/{place_id}", headers=headers, timeout=30)
    r.raise_for_status()
    payload = r.json()
    if "error" in payload:
        return {}
    return {
        "name": (payload.get("displayName") or {}).get("text", ""),
        "formatted_phone_number": payload.get("nationalPhoneNumber"),
        "website": payload.get("websiteUri"),
        "business_status": payload.get("businessStatus"),
        "formatted_address": payload.get("formattedAddress", ""),
    }


def texas_address(address: str) -> bool:
    if not address:
        return True
    return bool(re.search(r"\bTX\b|\bTexas\b", address, re.IGNORECASE))


def _niche_from_query(query: str) -> str:
    for area in AREAS:
        if area.lower() in query.lower():
            niche = query.replace(area, "").strip()
            return niche or "local service"
    return query


def lead_from_place(place: dict, query: str) -> LeadRow | None:
    """Build a lead directly from Text Search data — no Details call needed."""
    if place.get("websiteUri"):
        return None
    if place.get("businessStatus") == "CLOSED_PERMANENTLY":
        return None
    name = (place.get("displayName") or {}).get("text", "").strip()
    if not name:
        return None
    phone = normalize_phone(place.get("nationalPhoneNumber"))
    if not phone:
        return None
    if not texas_address(place.get("formattedAddress", "")):
        return None
    return LeadRow(
        business_name=name,
        phone=phone,
        website=None,
        niche=_niche_from_query(query),
        assigned_rep="",
    )


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
    phone = normalize_phone(details.get("formatted_phone_number"))
    if not phone:
        return None
    if not texas_address(details.get("formatted_address", "")):
        return None
    return LeadRow(
        business_name=name,
        phone=phone,
        website=None,
        niche=_niche_from_query(query),
        assigned_rep="",
    )


def run_search(
    api_key: str,
    query: str,
    search_cache: dict,
    today: str,
) -> tuple[str, list[dict], int]:
    """Returns (query, places_with_data, text_search_http_calls). 0 if cache hit."""
    if search_cache_valid(search_cache, query):
        cached = search_cache[query]
        # Handle old cache format (place_ids list) and new format (places list)
        if "places" in cached:
            return query, cached["places"], 0
        # Migrate old format: return bare dicts with just id so seen_ids dedup still works
        return query, [{"id": pid} for pid in cached.get("place_ids", [])], 0

    places, http_calls = places_text_search(api_key, query)
    search_cache[query] = {"fetched": today, "places": places}
    return query, places, http_calls


def count_new_per_rep() -> dict[str, int]:
    return db.count_new_per_rep(REPS)


def all_reps_at_cap(counts: dict[str, int]) -> bool:
    return all(counts.get(rep, 0) >= MAX_NEW_PER_REP for rep in REPS)


def pick_rep_for_insert(counts: dict[str, int]) -> str | None:
    eligible = [(rep, counts.get(rep, 0)) for rep in REPS if counts.get(rep, 0) < MAX_NEW_PER_REP]
    if not eligible:
        return None
    eligible.sort(key=lambda x: x[1])
    return eligible[0][0]


def upsert_leads(rows: list[LeadRow]) -> int:
    payload = [
        {
            "business_name": row.business_name,
            "phone": row.phone,
            "website": row.website,
            "niche": row.niche,
            "status": row.status,
            "assigned_rep": row.assigned_rep,
        }
        for row in rows
        if row.assigned_rep
    ]
    return db.upsert_leads(payload)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [SCRAPER] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    api_key = require_env("GOOGLE_MAPS_API_KEY")
    db.init_db()
    run_id = db.start_scraper_run()
    search_api_calls = 0
    search_cache_hits = 0
    text_search_http_calls = 0
    place_details_http_calls = 0
    inserted = 0

    try:
        rep_counts = count_new_per_rep()
        LOG.info(
            "New leads per rep: %s",
            ", ".join(f"{r}={rep_counts.get(r, 0)}" for r in REPS),
        )

        if all_reps_at_cap(rep_counts):
            LOG.info("Both reps at cap (%d each); skipping Places API", MAX_NEW_PER_REP)
            db.finish_scraper_run(
                run_id,
                {
                    "status": "skipped",
                    "leads_upserted": 0,
                    "search_api_calls": 0,
                    "search_cache_hits": 0,
                    "text_search_http_calls": 0,
                    "place_details_http_calls": 0,
                    "estimated_usd": 0.0,
                },
            )
            return

        today = str(date.today())
        search_cache = load_json(SEARCH_CACHE_FILE, {})
        seen_ids = set(load_json(SEEN_PLACE_IDS_FILE, []))

        all_queries = [f"{niche} {area}" for niche in NICHES for area in AREAS]
        rng = random.Random(date.today().toordinal())
        rng.shuffle(all_queries)
        queries = all_queries[:SEARCHES_PER_RUN]

        LOG.info("Running %d searches (TTL %dd)...", len(queries), SEARCH_CACHE_TTL_DAYS)

        # (place_id, query, place_data) — only no-website places not yet seen
        candidates: list[tuple[str, str, dict]] = []
        seen_this_run: set[str] = set()
        pre_filtered = 0  # places skipped because they had a website in search data

        with ThreadPoolExecutor(max_workers=SEARCH_WORKERS) as pool:
            futures = {
                pool.submit(run_search, api_key, q, search_cache, today): q
                for q in queries
            }
            for future in as_completed(futures):
                query, places, http_used = future.result()
                if http_used:
                    search_api_calls += 1
                    text_search_http_calls += http_used
                else:
                    search_cache_hits += 1
                for place in places:
                    pid = place.get("id")
                    if not pid or pid in seen_ids or pid in seen_this_run:
                        continue
                    seen_this_run.add(pid)
                    if place.get("websiteUri"):
                        pre_filtered += 1
                        continue
                    candidates.append((pid, query, place))

        LOG.info(
            "Search queries (uncached): %d | cache hits: %d | text HTTP: %d | "
            "pre-filtered (has website): %d | candidates: %d",
            search_api_calls,
            search_cache_hits,
            text_search_http_calls,
            pre_filtered,
            len(candidates),
        )

        new_leads: list[LeadRow] = []
        details_budget = MAX_DETAILS_PER_RUN

        for pid, query, place_data in candidates:
            if all_reps_at_cap(rep_counts):
                break

            # Try to build the lead from Text Search data first (no API call)
            lead = lead_from_place(place_data, query)

            if lead is None and not place_data.get("websiteUri") and details_budget > 0:
                # No website in search data but missing phone or name — rare, use Details
                details = places_details(api_key, pid)
                place_details_http_calls += 1
                details_budget -= 1
                lead = lead_from_details(pid, query, details)

            if not lead:
                continue

            assign_rep = pick_rep_for_insert(rep_counts)
            if not assign_rep:
                LOG.info("All reps at cap mid-run; stopping")
                break
            lead.assigned_rep = assign_rep
            new_leads.append(lead)
            rep_counts[assign_rep] = rep_counts.get(assign_rep, 0) + 1
            LOG.info("✓ %s | %s → %s", lead.business_name, lead.phone, assign_rep)

        inserted = upsert_leads(new_leads)

        est = estimate_usd(
            text_search_http_calls=text_search_http_calls,
            place_details_http_calls=place_details_http_calls,
        )
        LOG.info(
            explain_for_log(
                search_queries_billed=search_api_calls,
                search_cache_hits=search_cache_hits,
                text_search_http_calls=text_search_http_calls,
                place_details_http_calls=place_details_http_calls,
                candidates=len(candidates),
                leads_upserted=inserted,
            )
        )

        seen_ids.update(seen_this_run)
        save_json(SEEN_PLACE_IDS_FILE, list(seen_ids))
        save_json(SEARCH_CACHE_FILE, search_cache)

        LOG.info("Done. Upserted %d leads.", inserted)

        db.finish_scraper_run(
            run_id,
            {
                "status": "ok",
                "leads_upserted": inserted,
                "search_api_calls": search_api_calls,
                "search_cache_hits": search_cache_hits,
                "text_search_http_calls": text_search_http_calls,
                "place_details_http_calls": place_details_http_calls,
                "estimated_usd": float(est["total_usd"]),
            },
        )
    except Exception as exc:
        db.finish_scraper_run(
            run_id,
            {
                "status": "error",
                "leads_upserted": inserted,
                "search_api_calls": search_api_calls,
                "search_cache_hits": search_cache_hits,
                "text_search_http_calls": text_search_http_calls,
                "place_details_http_calls": place_details_http_calls,
                "error_message": str(exc)[:500],
            },
        )
        LOG.exception("Scraper failed: %s", exc)
        raise


if __name__ == "__main__":
    main()
