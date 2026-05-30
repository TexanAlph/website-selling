-- Call learning loop: sessions, playbook, nightly insights, extended coach roles

-- ---------------------------------------------------------------------------
-- call_sessions (client UUID = id, same as coach session_id)
-- ---------------------------------------------------------------------------
create table if not exists public.call_sessions (
  id                uuid primary key,
  lead_id           uuid references public.leads (id) on delete set null,
  niche             text,
  call_source       text not null check (call_source in ('queue', 'keypad')),
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  outcome_status    text,
  duration_seconds  integer,
  transcript_full   text,
  summary           text,
  objections        jsonb,
  rep_score         smallint check (rep_score is null or (rep_score >= 1 and rep_score <= 10)),
  recommendations   text,
  opener_suggestion text,
  analysis_status   text not null default 'pending'
    check (analysis_status in ('pending', 'processing', 'completed', 'failed', 'skipped')),
  analyzed_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists call_sessions_pending_analysis_idx
  on public.call_sessions (ended_at asc)
  where analysis_status = 'pending' and ended_at is not null;

create index if not exists call_sessions_lead_idx
  on public.call_sessions (lead_id, started_at desc);

alter table public.call_sessions enable row level security;

create policy call_sessions_anon_select
  on public.call_sessions for select to anon using (true);

create policy call_sessions_anon_insert
  on public.call_sessions for insert to anon with check (true);

create policy call_sessions_anon_update
  on public.call_sessions for update to anon using (true) with check (true);

-- ---------------------------------------------------------------------------
-- playbook_entries (niche-specific winning counters)
-- ---------------------------------------------------------------------------
create table if not exists public.playbook_entries (
  id                 uuid primary key default gen_random_uuid(),
  niche              text not null default 'all',
  objection_pattern  text not null,
  winning_response   text not null,
  source_session_id  uuid references public.call_sessions (id) on delete set null,
  win_count          integer not null default 0,
  loss_count         integer not null default 0,
  score              numeric not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (niche, objection_pattern)
);

create index if not exists playbook_entries_niche_score_idx
  on public.playbook_entries (niche, score desc);

alter table public.playbook_entries enable row level security;

create policy playbook_entries_anon_select
  on public.playbook_entries for select to anon using (true);

-- Inserts/updates via service role (post-call + nightly jobs)

-- ---------------------------------------------------------------------------
-- daily_insights (nightly aggregate report)
-- ---------------------------------------------------------------------------
create table if not exists public.daily_insights (
  id          uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  content     jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.daily_insights enable row level security;

-- ---------------------------------------------------------------------------
-- Extend coach_messages roles
-- ---------------------------------------------------------------------------
alter table public.coach_messages
  drop constraint if exists coach_messages_role_check;

alter table public.coach_messages
  add constraint coach_messages_role_check
  check (role in ('transcript', 'counter', 'outcome', 'summary'));
