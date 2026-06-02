-- Run if 006–008 are already applied but per-rep queues are missing.
-- Project: guqbjbisqdswdomzwqll → Dashboard → SQL Editor

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
