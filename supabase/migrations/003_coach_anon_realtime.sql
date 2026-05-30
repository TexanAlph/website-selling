-- Coach realtime in browser uses anon key; app login is separate (cookie session)
drop policy if exists coach_messages_anon_select on public.coach_messages;
create policy coach_messages_anon_select
  on public.coach_messages for select
  to anon
  using (true);
