# Google Places API — exact billing for this scraper

Your scraper uses **Places API (Legacy)** endpoints:

- `place/textsearch/json` — Text Search (up to **3 HTTP calls** per query for pagination)
- `place/details/json` — Place Details ( **1 HTTP call per place ID** )

## What the log line “160 searches” usually means

The scraper counter `search_api_calls` = **number of uncached query strings** (e.g. 160 niche+area combos), **not** Google’s total billable HTTP events.

| Counter | Meaning |
|---------|---------|
| `search_api_calls` | Uncached **queries** (one per matrix cell hit this run) |
| `text_search_http_calls` | Actual **HTTP** Text Search requests (pages of results) |
| `place_details_http_calls` | One per candidate place ID looked up |

After the update, each run logs:  
`Billing estimate … text_HTTP=… details_HTTP=… total≈$…`

## Official legacy SKU prices (USD per 1,000 events)

From [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing) — **Places API Legacy**:

| SKU | Free / month | Then per 1,000 |
|-----|----------------|----------------|
| Places - Text Search | 5,000 | **$32.00** |
| Places Details | 5,000 | **$17.00** |
| Contact Data | 1,000 | **$3.00** |
| Atmosphere Data | 1,000 | **$5.00** |
| Basic Data | Unlimited | **$0** |

### Text Search (each HTTP page)

Google bills **Text Search + Contact + Atmosphere** on each Text Search response (not just $32/1000).

Conservative cost **after free tier**:

**$0.040 per Text Search HTTP call**  
($32 + $3 + $5) / 1000

### Place Details (our fields: phone, website, rating, address, …)

**$0.025 per Details HTTP call**  
($17 + $3 + $5) / 1000

## Reconciling your ~$38 with “160 searches”

If **160** = uncached **queries** (one run at `SEARCHES_PER_RUN=80` × 2 runs, or 160 configured):

Assume average **2 pagination pages** per query:

| Line item | Count | × rate | Cost |
|-----------|-------|--------|------|
| Text Search HTTP | 160 × 2 = **320** | $0.040 | **$12.80** |
| Place Details | **~1,000** | $0.025 | **$25.00** |
| **Total** | | | **~$37.80** |

So **~$38 fits** if you had about **160 uncached queries** and roughly **1,000 Detail lookups** on new place IDs (many listings per search, most filtered out for having a website).

If **160** were only Text Search HTTP calls (no Details):

160 × $0.040 = **$6.40** — nowhere near $38 → **Details dominated the bill**.

## How to see the exact numbers (your Google account)

1. [Google Cloud Console](https://console.cloud.google.com) → **Billing** → **Reports**
2. Filter **SKU** (last 30 days), look for:
   - `Places - Text Search`
   - `Places Details`
   - `Contact Data`
   - `Atmosphere Data`
3. Compare event counts to the scraper log line after the next run.

`scraper_runs` in Supabase is empty until the Mac Mini runs with migration `008` (optional columns for HTTP counts).

## Reduce spend

- **Rep cap (code):** scraper skips all Google API when both `david` and `roslyn` have **100** `New` leads
- Default **40** searches/run, **1** text page, **120** details max (see `headless_scraper.py` constants)
- `SEARCH_CACHE_TTL_DAYS=14` (env optional)
- Run **once daily** (cache reuse)
- Scraper already skips Details for known `place_id`s in `~/.web-dialer/seen_place_ids.json`
