-- Run once in Supabase Dashboard → SQL Editor (project guqbjbisqdswdomzwqll)
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS where needed

-- ========== 006 production ==========
alter table public.leads
  add column if not exists status_changed_at timestamptz not null default now();

update public.leads
set status_changed_at = coalesce(created_at, now())
where status_changed_at is null;

alter table public.call_sessions
  add column if not exists rep_name text;

create index if not exists call_sessions_rep_started_idx
  on public.call_sessions (rep_name, started_at desc);

create table if not exists public.scraper_runs (
  id                uuid primary key default gen_random_uuid(),
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running'
    check (status in ('running', 'ok', 'error', 'skipped')),
  leads_upserted    integer not null default 0,
  search_api_calls  integer not null default 0,
  search_cache_hits integer not null default 0,
  error_message     text,
  created_at        timestamptz not null default now()
);

create index if not exists scraper_runs_started_idx
  on public.scraper_runs (started_at desc);

alter table public.scraper_runs enable row level security;

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

do $$ begin
  create policy coach_feedback_anon_insert on public.coach_feedback for insert to anon with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy coach_feedback_anon_select on public.coach_feedback for select to anon using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy daily_insights_anon_select on public.daily_insights for select to anon using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy scraper_runs_anon_select on public.scraper_runs for select to anon using (true);
exception when duplicate_object then null; end $$;

-- ========== 007 anon writes + realtime ==========
do $$ begin
  create policy playbook_entries_anon_insert on public.playbook_entries for insert to anon with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy playbook_entries_anon_update on public.playbook_entries for update to anon using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy daily_insights_anon_insert on public.daily_insights for insert to anon with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy daily_insights_anon_update on public.daily_insights for update to anon using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy scraper_runs_anon_insert on public.scraper_runs for insert to anon with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy scraper_runs_anon_update on public.scraper_runs for update to anon using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;
end $$;

-- ========== 008 scraper billing ==========
alter table public.scraper_runs
  add column if not exists text_search_http_calls integer not null default 0,
  add column if not exists place_details_http_calls integer not null default 0,
  add column if not exists estimated_usd numeric(10, 2);

-- ========== 009 rep leads ==========
alter table public.leads
  add column if not exists assigned_rep text
    check (assigned_rep is null or assigned_rep in ('david', 'x'));

create index if not exists leads_rep_status_new_idx
  on public.leads (assigned_rep, created_at asc)
  where status = 'New';

update public.leads
set assigned_rep = case when (abs(hashtext(id::text)) % 2) = 0 then 'david' else 'x' end
where assigned_rep is null;

alter table public.scraper_runs drop constraint if exists scraper_runs_status_check;
alter table public.scraper_runs
  add constraint scraper_runs_status_check
  check (status in ('running', 'ok', 'error', 'skipped'));

-- ========== 010 speaker roles ==========
alter table public.coach_messages
  drop constraint if exists coach_messages_role_check;

alter table public.coach_messages
  add constraint coach_messages_role_check
  check (role in (
    'transcript',
    'transcript_prospect',
    'transcript_rep',
    'counter',
    'outcome',
    'summary'
  ));
