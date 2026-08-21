-- Non-destructive migration: reminders / alarms.
-- A reminder fires a phone push (default notification tone) + in-app notice +
-- email at remind_at. A pg_cron job pings the app once a minute to dispatch
-- anything due. Safe to run repeatedly.

-- ── reminders table ───────────────────────────────────────────────────────────
create table if not exists public.reminders (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  created_by    uuid references public.family_members(id) on delete set null,
  entity_type   text,                       -- 'task','expense','document',…,'custom'
  entity_id     uuid,
  title         text not null,
  body          text,
  link          text,                       -- app path to open on tap
  remind_at     timestamptz not null,
  recipient_ids uuid[] not null default '{}',   -- family_member ids to notify
  channel_push  boolean not null default true,
  channel_email boolean not null default true,
  status        text not null default 'pending',  -- pending | sent | cancelled | error
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists reminders_due_idx on public.reminders (status, remind_at);
create index if not exists reminders_family_idx on public.reminders (family_id);

alter table public.reminders enable row level security;

do $$ begin
  create policy "reminders read" on public.reminders
    for select using (public.is_family_member(family_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "reminders write" on public.reminders
    for all using (public.is_family_member(family_id))
    with check (public.is_family_member(family_id));
exception when duplicate_object then null; end $$;

-- ── config: cron secret (app_url is set by the app at runtime) ─────────────────
insert into public.app_config(key, value)
values ('cron_secret', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- ── scheduler: pg_cron + pg_net ping the app every minute ─────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Posts to <app_url>/api/cron/reminders with the shared secret, but only when
-- something is actually due (keeps it quiet otherwise).
create or replace function public.dispatch_due_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  secret   text;
begin
  select value into base_url from public.app_config where key = 'app_url';
  select value into secret   from public.app_config where key = 'cron_secret';
  if base_url is null or secret is null then
    return;  -- app hasn't recorded its URL yet
  end if;
  if not exists (select 1 from public.reminders where status = 'pending' and remind_at <= now()) then
    return;
  end if;
  perform net.http_post(
    url     := rtrim(base_url, '/') || '/api/cron/reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body    := '{}'::jsonb
  );
end $$;

do $$
begin
  perform cron.unschedule('family-hub-reminders');
exception when others then null;
end $$;

do $$
begin
  perform cron.schedule('family-hub-reminders', '* * * * *', 'select public.dispatch_due_reminders()');
exception when others then
  raise notice 'Could not schedule reminders cron: %', sqlerrm;
end $$;
