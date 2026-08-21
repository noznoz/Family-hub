-- ============================================================================
-- Family Hub — Push notifications (non-destructive; safe on a live database)
-- ============================================================================
create table if not exists public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
-- No policies: only the service role (server) can read/write. The VAPID private
-- key lives here and must never be readable by the browser.

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.family_members(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='push_subscriptions' and policyname='own subs read') then
    create policy "own subs read" on public.push_subscriptions for select
      using (member_id in (select id from public.family_members where profile_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='push_subscriptions' and policyname='own subs insert') then
    create policy "own subs insert" on public.push_subscriptions for insert
      with check (member_id in (select id from public.family_members where profile_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='push_subscriptions' and policyname='own subs delete') then
    create policy "own subs delete" on public.push_subscriptions for delete
      using (member_id in (select id from public.family_members where profile_id = auth.uid()));
  end if;
end $$;

select 'push tables ready' as result;
