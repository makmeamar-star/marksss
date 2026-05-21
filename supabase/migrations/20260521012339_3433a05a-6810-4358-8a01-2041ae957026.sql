
create table public.pwa_install_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  platform text not null,
  outcome text,
  source text,
  session_id text,
  user_id uuid,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint pwa_install_events_event_chk check (event in (
    'pwa_install_prompt_shown',
    'pwa_install_prompt_clicked',
    'pwa_install_prompt_outcome',
    'pwa_install_prompt_dismissed',
    'pwa_installed'
  )),
  constraint pwa_install_events_platform_chk check (platform in ('android','ios','other')),
  constraint pwa_install_events_outcome_chk check (outcome is null or outcome in ('accepted','dismissed')),
  constraint pwa_install_events_source_chk check (source is null or source in ('user','auto')),
  constraint pwa_install_events_session_chk check (session_id is null or char_length(session_id) <= 64),
  constraint pwa_install_events_ua_chk check (user_agent is null or char_length(user_agent) <= 500)
);

create index pwa_install_events_created_at_idx on public.pwa_install_events (created_at desc);
create index pwa_install_events_event_platform_idx on public.pwa_install_events (event, platform);
create index pwa_install_events_session_idx on public.pwa_install_events (session_id);

alter table public.pwa_install_events enable row level security;

create policy "Anyone can record pwa install events"
on public.pwa_install_events
for insert
to anon, authenticated
with check (
  (user_id is null or user_id = auth.uid())
);

create policy "Admins read pwa install events"
on public.pwa_install_events
for select
to authenticated
using (has_role(auth.uid(), 'admin'::app_role));
