import subprocess
import json
import sqlite3
import gspread
from google.oauth2.service_account import Credentials
from datetime import date, datetime, timedelta
import os
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

creds = Credentials.from_service_account_file(
    '/Users/mongo/.openclaw/service-account.json',
    scopes=['https://www.googleapis.com/auth/spreadsheets']
)
gc = gspread.authorize(creds)
sheet = gc.open_by_key('1WASU7JWtL-lDxLBlQMpIHw67A6-vMFYg7R6lV_XJNL4').sheet1

CACHE_FILE = os.path.expanduser('~/.openclaw/seen_place_ids.json')
DB_FILE    = os.path.expanduser('~/.openclaw/leads.db')
SEARCH_CACHE_FILE = os.path.expanduser('~/.openclaw/search_cache.json')
SEARCH_CACHE_TTL_DAYS = 7

# --- Place ID cache ---
# Bootstrap from sheet column E if local cache is missing or empty,
# so a lost cache file never causes sheet duplicates.
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, 'r') as f:
        seen_ids = set(json.load(f))
else:
    seen_ids = set()

if not seen_ids:
    print("Place ID cache empty — bootstrapping from sheet...")
    all_rows = sheet.get_all_values()
    if all_rows:
        # Scan every cell for a Place ID pattern (handles old and new column layouts)
        sheet_ids = set()
        for row in all_rows[1:]:
            for cell in row:
                if cell.startswith('ChIJ'):
                    sheet_ids.add(cell)
                    break
        seen_ids = sheet_ids
        print(f"  Loaded {len(seen_ids)} place IDs from sheet.")

# --- Search result cache ---
# Stores {query: {"fetched": "YYYY-MM-DD", "place_ids": [...]}}
# Queries run within TTL reuse cached place_ids instead of hitting the Search API.
if os.path.exists(SEARCH_CACHE_FILE):
    with open(SEARCH_CACHE_FILE, 'r') as f:
        search_cache = json.load(f)
else:
    search_cache = {}

def search_cache_valid(query):
    entry = search_cache.get(query)
    if not entry:
        return False
    fetched = datetime.strptime(entry['fetched'], '%Y-%m-%d').date()
    return (date.today() - fetched) < timedelta(days=SEARCH_CACHE_TTL_DAYS)

# Columns: visible working area | 3 spacer cols | Place ID tucked away on the right
HEADERS = ['Business Name', 'Phone', 'Category', 'Date Found', 'Notes', 'Address', 'Rating', 'Status', '', '', '', 'Place ID']

existing = sheet.get_all_values()
if not existing:
    sheet.append_row(HEADERS)
elif existing[0] != HEADERS:
    sheet.update([HEADERS], 'A1')

CATEGORIES = [
    # Beauty & wellness
    "beauty salon",
    "nail salon",
    "massage",
    "barbershop",
    "medspa",
    "waxing studio",
    "eyelash extensions",
    "microblading",
    "hair braiding",
    "esthetics",
    "tattoo shop",
    "permanent makeup",
    # Home services
    "electrician",
    "plumber",
    "HVAC",
    "roofing",
    "painting contractor",
    "handyman",
    "landscaping",
    "lawn care",
    "tree service",
    "fence company",
    "pressure washing",
    "pest control",
    "pool service",
    "cleaning service",
    "carpet cleaning",
    "flooring contractor",
    "tile contractor",
    "drywall contractor",
    "concrete contractor",
    "remodeling contractor",
    "garage door repair",
    "appliance repair",
    "locksmith",
    "gutter cleaning",
    "insulation contractor",
    "window and door",
    # Restoration & cleanup
    "junk removal",
    "mold remediation",
    "water damage restoration",
    "moving company",
    # Auto
    "auto repair",
    "mechanic",
    "auto body shop",
    "auto detailing",
    "window tinting",
    "tire shop",
    "car wash",
    "towing",
    # Food & hospitality
    "taqueria",
    "bakery",
    "food truck",
    "BBQ restaurant",
    "catering",
    "food catering",
    # Events & entertainment
    "DJ",
    "florist",
    "wedding photographer",
    "videographer",
    "bounce house rental",
    "party rental",
    "event planner",
    "wedding planner",
    "photo booth rental",
    # Fitness & wellness
    "personal trainer",
    "yoga studio",
    "martial arts",
    "dance studio",
    "chiropractic",
    "acupuncture",
    # Education & instruction
    "tutoring",
    "music lessons",
    "driving school",
    # Pet services
    "pet grooming",
    "dog training",
    "dog boarding",
    # Repair & retail
    "phone repair",
    "computer repair",
    "shoe repair",
    "watch repair",
    "bicycle repair",
    "dry cleaning",
    "alterations tailor",
    # Professional
    "notary",
    "tax preparation",
    "bookkeeping",
    # Other
    "photography",
    "daycare",
    "screen printing",
]

AREAS = [
    # San Antonio
    "San Antonio Texas",
    "North San Antonio Texas",
    "South San Antonio Texas",
    "Northwest San Antonio Texas",
    "Northeast San Antonio Texas",
    "Stone Oak San Antonio Texas",
    "Alamo Heights San Antonio Texas",
    "Leon Valley Texas",
    "Converse Texas",
    "Live Oak Texas",
    "Universal City Texas",
    "Helotes Texas",
    "Schertz Texas",
    # Austin
    "Austin Texas",
    "North Austin Texas",
    "South Austin Texas",
    "East Austin Texas",
    "Round Rock Texas",
    "Cedar Park Texas",
    "Pflugerville Texas",
    "Georgetown Texas",
    "Kyle Texas",
    "Buda Texas",
]

all_searches = [f"{cat} {area}" for cat in CATEGORIES for area in AREAS]

# Rotate daily so each run covers a fresh slice of the full search space
rng = random.Random(date.today().toordinal())
rng.shuffle(all_searches)
searches = all_searches[:100]

today = str(date.today())
search_cache_hits = 0
search_api_calls = 0


def run_search(query):
    """Return (query, place_id_list). Uses local cache if fresh enough."""
    global search_cache_hits, search_api_calls
    if search_cache_valid(query):
        search_cache_hits += 1
        return query, [{'place_id': pid} for pid in search_cache[query]['place_ids']]
    try:
        r = subprocess.run(
            ['/opt/homebrew/bin/goplaces', 'search', query, '--json', '--limit', '20'],
            capture_output=True, text=True, timeout=30
        )
        if r.returncode != 0 or not r.stdout.strip():
            return query, []
        places = json.loads(r.stdout).get('results', [])
        search_api_calls += 1
        # Store result in search cache
        search_cache[query] = {
            'fetched': today,
            'place_ids': [p['place_id'] for p in places if p.get('place_id')],
        }
        return query, places
    except Exception as e:
        print(f"  Search error ({query}): {e}")
        return query, []


def get_details(place_id):
    try:
        r = subprocess.run(
            ['/opt/homebrew/bin/goplaces', 'details', place_id, '--json'],
            capture_output=True, text=True, timeout=30
        )
        if r.returncode != 0 or not r.stdout.strip():
            return {}
        return json.loads(r.stdout)
    except Exception:
        return {}


# Phase 1: parallel searches (cached queries skip the API entirely)
print(f"Running {len(searches)} searches (cache TTL: {SEARCH_CACHE_TTL_DAYS}d)...")
candidates = []  # (place_id, query) — new to place cache, deduplicated
seen_this_run = set()

with ThreadPoolExecutor(max_workers=6) as ex:
    futures = {ex.submit(run_search, q): q for q in searches}
    for future in as_completed(futures):
        query, places = future.result()
        for place in places:
            pid = place.get('place_id')
            if pid and pid not in seen_ids and pid not in seen_this_run:
                seen_this_run.add(pid)
                candidates.append((pid, query))

print(f"  Search API calls: {search_api_calls} | Cache hits: {search_cache_hits}")
print(f"Found {len(candidates)} new candidates to check for websites...")


# Phase 2: parallel details calls
import re as _re

def check_candidate(args):
    pid, query = args
    d = get_details(pid)
    if not d or 'website' in d:
        return pid, None

    # Skip permanently closed businesses
    if d.get('business_status') == 'CLOSED_PERMANENTLY':
        return pid, None

    name  = d.get('name', '')
    phone = d.get('phone', '')
    if not name:
        return pid, None

    address      = d.get('formatted_address') or d.get('address') or d.get('vicinity', '')
    rating       = d.get('rating', '')
    review_count = d.get('user_ratings_total') or d.get('user_rating_count') or d.get('review_count')
    area         = next((a for a in AREAS if a.lower() in query.lower()), '')

    # Geographic filter: skip anything with a non-Texas address.
    # If address is empty we allow it through (can't confirm, but don't penalise).
    if address and not _re.search(r'\bTX\b|\bTexas\b', address, _re.IGNORECASE):
        return pid, None

    # Phone sanity check: must look like a US number (10 digits once stripped)
    if phone:
        digits = _re.sub(r'\D', '', phone)
        if len(digits) not in (10, 11):
            return pid, None

    # Write to SQLite — source of truth for the calling system
    if os.path.exists(DB_FILE):
        try:
            db = sqlite3.connect(DB_FILE)
            db.execute("""
                INSERT OR IGNORE INTO leads
                    (place_id, name, phone, category, area, address, rating, review_count, date_found)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, (pid, name, phone, query, area, address,
                  float(rating) if rating else None,
                  int(review_count) if review_count else None,
                  today))
            db.commit()
            db.close()
        except Exception:
            pass  # Don't let a DB write failure block the sheet write

    # Layout: Name | Phone | Category | Date | Notes | Address | Rating | Status | '' | '' | '' | Place ID
    return pid, [name, phone, query, today, '', address, rating, '', '', '', '', pid]

new_rows = []
with ThreadPoolExecutor(max_workers=6) as ex:
    for pid, row in ex.map(check_candidate, candidates):
        if row:
            new_rows.append(row)
            print(f"✓ {row[0]} | {row[1]}")

# Batch write — one Sheets API call
if new_rows:
    sheet.append_rows(new_rows)

# Persist caches
seen_ids.update(seen_this_run)
with open(CACHE_FILE, 'w') as f:
    json.dump(list(seen_ids), f)

with open(SEARCH_CACHE_FILE, 'w') as f:
    json.dump(search_cache, f)

details_calls = len(candidates)
print(f"\nDone. {len(new_rows)} new leads added.")
print(f"API calls this run — Search: {search_api_calls}, Details: {details_calls}")
