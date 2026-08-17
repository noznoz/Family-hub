-- ============================================================================
-- Family Hub — FIX: remove FORCE ROW LEVEL SECURITY (stops policy recursion)
-- Safe, non-destructive. Run once in the Supabase SQL Editor. No data is lost.
-- RLS stays ENABLED for anon/authenticated (full protection); only the owner
-- FORCE flag is removed so SECURITY DEFINER helpers no longer recurse.
-- ============================================================================
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I no force row level security;', t);
  end loop;
end $$;

select 'FORCE RLS removed from all public tables. You can sign in now.' as result;
