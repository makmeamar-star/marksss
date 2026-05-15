
-- Enable pg_net for outbound HTTP from triggers
create extension if not exists pg_net with schema extensions;

-- Push subscriptions (one row per browser/device endpoint)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admins read all push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

-- Per-market alert preferences
create table public.market_alert_preferences (
  user_id uuid not null,
  market_id text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, market_id)
);
create index market_alert_preferences_market_id_idx
  on public.market_alert_preferences(market_id) where enabled = true;

alter table public.market_alert_preferences enable row level security;

create policy "Users manage own alert prefs"
  on public.market_alert_preferences for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admins read all alert prefs"
  on public.market_alert_preferences for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

-- Trigger: when a market_results row transitions to DECLARED,
-- POST a small payload to our public dispatch route.
create or replace function public.dispatch_result_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  dispatch_url text := 'https://project--ef1d2cf5-c490-445a-ae0d-f01e7b09548a.lovable.app/api/public/hooks/dispatch-result-push';
  internal_secret text;
begin
  -- Only fire on transitions INTO declared.
  if (tg_op = 'INSERT' and new.status = 'DECLARED')
     or (tg_op = 'UPDATE' and coalesce(old.status, '') <> 'DECLARED' and new.status = 'DECLARED') then
    -- Read the dispatch secret from app_settings (admins seed this from the app).
    select (value ->> 'secret') into internal_secret
      from public.app_settings
     where key = 'push_dispatch_secret'
     limit 1;

    if internal_secret is null then
      return new; -- Nothing to do until the secret is configured.
    end if;

    perform net.http_post(
      url := dispatch_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', internal_secret
      ),
      body := jsonb_build_object(
        'market_id', new.market_id,
        'session_date', new.session_date,
        'jodi', new.jodi,
        'open_pana', new.open_pana,
        'close_pana', new.close_pana
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_market_result_declared on public.market_results;
create trigger on_market_result_declared
after insert or update of status on public.market_results
for each row execute function public.dispatch_result_push();
