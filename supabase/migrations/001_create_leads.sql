-- Web Dialer: leads table + indexes + RLS for authenticated dialers
-- Run in Supabase SQL Editor or: supabase db push

create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  business_name text not null,
  phone         text not null unique,
  website       text,
  status        text not null default 'New'
    check (status in (
      'New',
      'Calling',
      'Wrong Number',
      'Not Interested',
      'Interested/Closed'
    )),
  niche         text,
  created_at    timestamptz not null default now()
);

create index if not exists leads_status_created_idx
  on public.leads (status, created_at asc);

comment on table public.leads is 'Outbound dialer queue; phone is globally unique for dedup.';

alter table public.leads enable row level security;

-- Authenticated team members (you + employee) can read and update leads
create policy "leads_select_authenticated"
  on public.leads for select
  to authenticated
  using (true);

create policy "leads_update_authenticated"
  on public.leads for update
  to authenticated
  using (true)
  with check (true);

-- Service role (Mac Mini scraper) bypasses RLS when using service_role key
