-- AI Coach: realtime counter-objections streamed to the dialer UI

create table if not exists public.coach_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null,
  lead_id     uuid references public.leads (id) on delete set null,
  role        text not null check (role in ('transcript', 'counter')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists coach_messages_session_created_idx
  on public.coach_messages (session_id, created_at asc);

alter table public.coach_messages enable row level security;

create policy "coach_select_authenticated"
  on public.coach_messages for select
  to authenticated
  using (true);

create policy "coach_insert_authenticated"
  on public.coach_messages for insert
  to authenticated
  with check (true);

-- After migration: Supabase Dashboard → Database → Publications → supabase_realtime
-- → add table `coach_messages`
