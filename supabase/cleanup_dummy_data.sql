-- ============================================================================
-- Family Hub — Remove development/demo seed data from the LIVE database.
--
-- Scope: the seeded family 11111111-…-111111111111.
-- Keeps:  the family, University of Surrey, the empty chat channels, the
--         support section headings, the admin (Dad) account, and the Hamza &
--         Omar student profiles (as clean shells).
-- Deletes: all sample tasks, messages, payment requests, budgets, expenses,
--          documents, trips, accommodation, funding/scholarships, academic
--          years/terms, notifications, calendar events, the demo recipe &
--          laundry guide, the placeholder relatives (Mom, Sister, Step Mom,
--          Step Dad), and any duplicate auto-created generic member rows.
-- Also:    clears the @example.com placeholder emails and fake student refs so
--          real values can be set.
--
-- Idempotent: safe to run more than once.
-- ============================================================================
begin;

-- ---- Reference ids ----------------------------------------------------------
-- family        11111111-1111-1111-1111-111111111111
-- student prof  44444444-…-444444444406 (Hamza), 44444444-…-444444444407 (Omar)
-- members       …301 Dad(keep) …302 Mom …303 Sister …304 Step Mom …305 Step Dad
--               …306 Hamza(keep) …307 Omar(keep)

-- ---- Sample activity / content (scoped to the family) -----------------------
delete from public.tasks             where family_id = '11111111-1111-1111-1111-111111111111';
delete from public.payment_requests  where family_id = '11111111-1111-1111-1111-111111111111';
delete from public.expenses          where family_id = '11111111-1111-1111-1111-111111111111';
delete from public.budgets           where family_id = '11111111-1111-1111-1111-111111111111';
delete from public.documents         where family_id = '11111111-1111-1111-1111-111111111111'; -- cascades versions/shares
delete from public.trips             where family_id = '11111111-1111-1111-1111-111111111111'; -- cascades trip_members/flights
delete from public.accommodations    where family_id = '11111111-1111-1111-1111-111111111111'; -- cascades photos
delete from public.calendar_events   where family_id = '11111111-1111-1111-1111-111111111111';
delete from public.notifications     where family_id = '11111111-1111-1111-1111-111111111111';

-- ---- Scholarships / funding / academic history -----------------------------
delete from public.scholarships
  where student_id in ('44444444-4444-4444-4444-444444444406','44444444-4444-4444-4444-444444444407'); -- cascades requirements
delete from public.funding_sources   where family_id = '11111111-1111-1111-1111-111111111111';
delete from public.academic_terms
  where academic_year_id in (
    select id from public.academic_years
    where student_id in ('44444444-4444-4444-4444-444444444406','44444444-4444-4444-4444-444444444407')
  );
delete from public.academic_years
  where student_id in ('44444444-4444-4444-4444-444444444406','44444444-4444-4444-4444-444444444407');

-- ---- Chat: drop all sample messages, keep the (now empty) channels ----------
delete from public.messages
  where conversation_id in (
    select id from public.conversations where family_id = '11111111-1111-1111-1111-111111111111'
  );

-- ---- Support: drop the demo guide & recipe, keep the category headings ------
delete from public.support_guides    where family_id = '11111111-1111-1111-1111-111111111111'; -- cascades steps/media/audio
delete from public.recipes           where family_id = '11111111-1111-1111-1111-111111111111'; -- cascades ingredients/steps/media/audio/favorites

-- ---- Members: remove placeholder relatives + any duplicate generic rows -----
delete from public.family_members
  where id in (
    '33333333-3333-3333-3333-333333333302', -- Mom
    '33333333-3333-3333-3333-333333333303', -- Sister
    '33333333-3333-3333-3333-333333333304', -- Step Mom
    '33333333-3333-3333-3333-333333333305'  -- Step Dad
  );
-- Duplicate accounts auto-created before email linking was fixed (e.g. a
-- generic "Hamza" family_member). Never matches Dad (admin) or the student
-- slots (which are still unlinked), so they are preserved.
delete from public.family_members
  where family_id = '11111111-1111-1111-1111-111111111111'
    and role = 'family_member'
    and profile_id is not null;

-- ---- Clean the kept profiles ------------------------------------------------
update public.family_members
  set invite_email = null
  where family_id = '11111111-1111-1111-1111-111111111111'
    and invite_email ilike '%@example.com';
update public.student_profiles
  set student_ref = null
  where id in ('44444444-4444-4444-4444-444444444406','44444444-4444-4444-4444-444444444407');

commit;
