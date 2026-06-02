alter table public.scraper_runs
  add column if not exists text_search_http_calls integer not null default 0,
  add column if not exists place_details_http_calls integer not null default 0,
  add column if not exists estimated_usd numeric;
