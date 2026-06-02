-- Dialer can write playbook/insights/scraper_runs with anon key (no service role on Vercel).
-- Realtime queue count for leads.

drop policy if exists playbook_entries_anon_insert on public.playbook_entries;
create policy playbook_entries_anon_insert
  on public.playbook_entries for insert to anon with check (true);

drop policy if exists playbook_entries_anon_update on public.playbook_entries;
create policy playbook_entries_anon_update
  on public.playbook_entries for update to anon using (true) with check (true);

drop policy if exists daily_insights_anon_insert on public.daily_insights;
create policy daily_insights_anon_insert
  on public.daily_insights for insert to anon with check (true);

drop policy if exists scraper_runs_anon_insert on public.scraper_runs;
create policy scraper_runs_anon_insert
  on public.scraper_runs for insert to anon with check (true);

drop policy if exists scraper_runs_anon_update on public.scraper_runs;
create policy scraper_runs_anon_update
  on public.scraper_runs for update to anon using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'coach_messages'
  ) then
    alter publication supabase_realtime add table public.coach_messages;
  end if;
end $$;
