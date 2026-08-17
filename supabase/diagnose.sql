\set ON_ERROR_STOP 0
\echo '########## Family Hub — RLS diagnosis (as authenticated user) ##########'
-- Impersonate the real signed-in user (Dad) captured from /debug
select set_config('request.jwt.claim.sub','3534fe03-9902-45d2-9848-b6a2e9caeb3c', false);
select set_config('request.jwt.claims','{"sub":"3534fe03-9902-45d2-9848-b6a2e9caeb3c","role":"authenticated"}', false);
set role authenticated;

\echo '=== Per-table SELECT as authenticated — any ERROR line reveals the culprit ==='
\echo '--- family_members';   select count(*) from public.family_members;
\echo '--- student_profiles'; select count(*) from public.student_profiles;
\echo '--- academic_years';   select count(*) from public.academic_years;
\echo '--- funding_sources';  select count(*) from public.funding_sources;
\echo '--- scholarships';     select count(*) from public.scholarships;
\echo '--- tasks';            select count(*) from public.tasks;
\echo '--- trips';            select count(*) from public.trips;
\echo '--- trip_members';     select count(*) from public.trip_members;
\echo '--- payment_requests'; select count(*) from public.payment_requests;
\echo '--- documents';        select count(*) from public.documents;
\echo '--- universities';     select count(*) from public.universities;
\echo '--- expenses';         select count(*) from public.expenses;
\echo '--- budgets';          select count(*) from public.budgets;

\echo '=== The actual /home student query (join) ==='
select sp.id, fm.display_name
from public.student_profiles sp
join public.family_members fm on fm.id = sp.member_id
limit 5;

reset role;
\echo '########## done ##########'
