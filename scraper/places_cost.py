"""
Google Places API (Legacy) — USD estimate for scraper logs.

Official list prices (per 1,000 billable events, after monthly free caps):
  https://developers.google.com/maps/billing-and-pricing/pricing

Legacy Text Search (each HTTP page, including pagination):
  - Places - Text Search: $32.00
  - Contact Data (bundled in Text Search response): $3.00
  - Atmosphere Data (bundled): $5.00
  - Basic Data: $0 (unlimited on legacy table)

Legacy Place Details (our field mask: phone, website, rating, address, …):
  - Places Details: $17.00
  - Contact Data: $3.00
  - Atmosphere Data: $5.00
  - Basic Data: $0
"""

from __future__ import annotations

# Per HTTP request, after free tier exhausted (conservative / worst-case)
TEXT_SEARCH_HTTP_USD = (32.0 + 3.0 + 5.0) / 1000  # $0.040
PLACE_DETAILS_HTTP_USD = (17.0 + 3.0 + 5.0) / 1000  # $0.025


def estimate_usd(
    *,
    text_search_http_calls: int,
    place_details_http_calls: int,
) -> dict[str, float | int]:
    text_cost = round(text_search_http_calls * TEXT_SEARCH_HTTP_USD, 2)
    details_cost = round(place_details_http_calls * PLACE_DETAILS_HTTP_USD, 2)
    total = round(text_cost + details_cost, 2)
    return {
        "text_search_http_calls": text_search_http_calls,
        "place_details_http_calls": place_details_http_calls,
        "text_search_usd": text_cost,
        "place_details_usd": details_cost,
        "total_usd": total,
    }


def explain_for_log(
    *,
    search_queries_billed: int,
    search_cache_hits: int,
    text_search_http_calls: int,
    place_details_http_calls: int,
    candidates: int,
    leads_upserted: int,
) -> str:
    est = estimate_usd(
        text_search_http_calls=text_search_http_calls,
        place_details_http_calls=place_details_http_calls,
    )
    return (
        f"Billing estimate (legacy SKU list prices, ignores monthly free caps): "
        f"queries={search_queries_billed} cache_hits={search_cache_hits} "
        f"text_HTTP={text_search_http_calls} (${est['text_search_usd']}) "
        f"details_HTTP={place_details_http_calls} (${est['place_details_usd']}) "
        f"total≈${est['total_usd']} | candidates={candidates} leads={leads_upserted}"
    )
