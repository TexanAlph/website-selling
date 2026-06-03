"""
Google Places API (New) — USD estimate for scraper logs.

Official list prices (per 1,000 requests, after $200/mo free credit):
  https://developers.google.com/maps/billing-and-pricing/pricing

Text Search (New) — tier determined by highest field in the FieldMask:
  - Basic  (id, displayName, formattedAddress, businessStatus, …): $32.00
  - Advanced (+ nationalPhoneNumber, websiteUri, …):               $35.00
  - Preferred (+ reviews, opening hours, …):                       $40.00

We request Advanced fields (websiteUri, nationalPhoneNumber) in Text Search
so we can pre-filter businesses with websites before calling Place Details.

Place Details (New) — same tier structure:
  - Basic:    $17.00
  - Advanced: $20.00  ← our field mask (nationalPhoneNumber, websiteUri)
  - Preferred: $25.00
"""

from __future__ import annotations

# Per HTTP request, after $200/mo free credit exhausted
TEXT_SEARCH_HTTP_USD = 35.0 / 1000   # $0.035 — Advanced tier
PLACE_DETAILS_HTTP_USD = 20.0 / 1000  # $0.020 — Advanced tier (fallback only)


def estimate_usd(
    *,
    text_search_http_calls: int,
    place_details_http_calls: int,
) -> dict[str, float | int]:
    text_cost = round(text_search_http_calls * TEXT_SEARCH_HTTP_USD, 4)
    details_cost = round(place_details_http_calls * PLACE_DETAILS_HTTP_USD, 4)
    total = round(text_cost + details_cost, 4)
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
        f"Billing (Places API New, list price, ignores $200/mo free credit): "
        f"text_HTTP={text_search_http_calls} (${est['text_search_usd']}) "
        f"details_HTTP={place_details_http_calls} (${est['place_details_usd']}) "
        f"total≈${est['total_usd']} | cache_hits={search_cache_hits} "
        f"candidates={candidates} leads={leads_upserted}"
    )
