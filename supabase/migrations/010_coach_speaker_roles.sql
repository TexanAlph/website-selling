-- Labeled call lines from Twilio Media Streams (prospect vs rep legs)

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
