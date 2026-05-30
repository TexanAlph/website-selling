-- Dialer uses anon key (app login is cookie-based). Mac Mini scraper still uses service_role.

drop policy if exists leads_anon_select on public.leads;
drop policy if exists leads_anon_update on public.leads;

create policy leads_anon_select
  on public.leads for select
  to anon
  using (true);

create policy leads_anon_update
  on public.leads for update
  to anon
  using (true)
  with check (true);

drop policy if exists coach_messages_anon_insert on public.coach_messages;

create policy coach_messages_anon_insert
  on public.coach_messages for insert
  to anon
  with check (true);
