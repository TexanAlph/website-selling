-- Production: rep tracking, scraper health, stale Calling recovery, insights read access

-- ---------------------------------------------------------------------------
-- Leads: track when status last changed (for stale Calling reset)
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists status_changed_at timestamptz not null default now();

update public.leads
set status_changed_at = coalesce(created_at, now())
where status_changed_at is null;

-- ---------------------------------------------------------------------------
-- call_sessions: which rep placed the call
-- ---------------------------------------------------------------------------
alter table public.call_sessions
  add column if not exists rep_name text;

create index if not exists call_sessions_rep_started_idx
  on public.call_sessions (rep_name, started_at desc);

-- ---------------------------------------------------------------------------
-- scraper_runs: Mac Mini health / last successful ingest
-- ---------------------------------------------------------------------------
create table if not exists public.scraper_runs (
  id                uuid primary key default gen_random_uuid(),
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running'
    check (status in ('running', 'ok', 'error')),
  leads_upserted    integer not null default 0,
  search_api_calls  integer not null default 0,
  search_cache_hits integer not null default 0,
  error_message     text,
  created_at        timestamptz not null default now()
);

create index if not exists scraper_runs_started_idx
  on public.scraper_runs (started_at desc);

alter table public.scraper_runs enable row level security;

-- ---------------------------------------------------------------------------
-- coach_feedback: rep rates a counter suggestion
-- ---------------------------------------------------------------------------
create table if not exists public.coach_feedback (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null,
  message_id      uuid references public.coach_messages (id) on delete cascade,
  rep_name        text not null,
  helpful         boolean not null,
  created_at      timestamptz not null default now()
);

create index if not exists coach_feedback_session_idx
  on public.coach_feedback (session_id, created_at desc);

alter table public.coach_feedback enable row level security;

create policy coach_feedback_anon_insert
  on public.coach_feedback for insert to anon with check (true);

create policy coach_feedback_anon_select
  on public.coach_feedback for select to anon using (true);

-- Dialer reads insights + scraper health (writes still service role / cron)
create policy daily_insights_anon_select
  on public.daily_insights for select to anon using (true);

create policy scraper_runs_anon_select
  on public.scraper_runs for select to anon using (true);

-- ---------------------------------------------------------------------------
-- Realtime: Dashboard → Publications → supabase_realtime → add table `leads`
-- (Instant queue count in the dialer; coach_messages should already be enabled.)
-- ---------------------------------------------------------------------------
