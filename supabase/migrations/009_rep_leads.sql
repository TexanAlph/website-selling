-- Per-rep lead queues (david / x) with ~100 New cap enforced in scraper + dialer

alter table public.leads
  add column if not exists assigned_rep text
    check (assigned_rep is null or assigned_rep in ('david', 'x'));

create index if not exists leads_rep_status_new_idx
  on public.leads (assigned_rep, created_at asc)
  where status = 'New';

comment on column public.leads.assigned_rep is 'Dialer login: david or x; null = unassigned until backfill';

update public.leads
set assigned_rep = case when (abs(hashtext(id::text)) % 2) = 0 then 'david' else 'x' end
where assigned_rep is null;

alter table public.scraper_runs
  drop constraint if exists scraper_runs_status_check;

alter table public.scraper_runs
  add constraint scraper_runs_status_check
  check (status in ('running', 'ok', 'error', 'skipped'));
