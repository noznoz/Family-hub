-- Non-destructive migration: ensure the server-only app_config table exists.
-- Stores secrets/config (Resend key, sender, app URL, VAPID keys). RLS is on
-- with NO policies, so only the service role (server) can read/write it — the
-- values are never exposed to the browser. Safe to re-run.

create table if not exists public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
