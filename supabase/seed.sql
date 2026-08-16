-- ============================================================================
-- Family Hub — Development Seed Data
-- Scoped to ONE demo family id for trivial removal (see seed_teardown.sql).
--
-- AUTH: members are seeded WITHOUT profile_id (invite state). To log in as a
-- member, create the auth user in Supabase, then link by email (helper at end).
-- ============================================================================
begin;

-- Reference ids -------------------------------------------------------------
--   family      11111111-1111-1111-1111-111111111111
--   university  22222222-2222-2222-2222-222222222201
--   members     33333333-...-3333333333 0(1..7)
--   students    44444444-...-4444444444 0(6=Hamza,7=Omar)
--   funding     55555555-...-5555555555 0(6,7)

insert into public.families (id, name)
values ('11111111-1111-1111-1111-111111111111','The Family')
on conflict (id) do nothing;

insert into public.universities (id, family_id, name, city, country)
values ('22222222-2222-2222-2222-222222222201','11111111-1111-1111-1111-111111111111','University of Surrey','Guildford','United Kingdom')
on conflict (id) do nothing;

-- family members (relationship != role)
insert into public.family_members (id, family_id, display_name, role, status, is_student, invite_email) values
  ('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111111','Dad','admin','active',false,'dad@example.com'),
  ('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111111','Mom','parent','active',false,'mom@example.com'),
  ('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111111','Sister','family_member','active',false,'sister@example.com'),
  ('33333333-3333-3333-3333-333333333304','11111111-1111-1111-1111-111111111111','Step Mom','parent','active',false,'stepmom@example.com'),
  ('33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111111','Step Dad','family_member','active',false,'stepdad@example.com'),
  ('33333333-3333-3333-3333-333333333306','11111111-1111-1111-1111-111111111111','Hamza','student','active',true,'hamza@example.com'),
  ('33333333-3333-3333-3333-333333333307','11111111-1111-1111-1111-111111111111','Omar','student','active',true,'omar@example.com')
on conflict (id) do nothing;

insert into public.family_relationships (family_id, member_id, related_member_id, relationship) values
  ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333301','33333333-3333-3333-3333-333333333306','dad'),
  ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333302','33333333-3333-3333-3333-333333333306','mom'),
  ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333304','33333333-3333-3333-3333-333333333307','step_mom')
on conflict do nothing;

insert into public.student_profiles (id, family_id, member_id, university_id, course, student_ref, status, overall_status, start_date, expected_graduation) values
  ('44444444-4444-4444-4444-444444444406','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333306','22222222-2222-2222-2222-222222222201','BSc Computer Science','SUR-HAMZA-01','active','On track','2026-09-21','2029-06-30'),
  ('44444444-4444-4444-4444-444444444407','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333307','22222222-2222-2222-2222-222222222201','BSc Mechanical Engineering','SUR-OMAR-01','active','On track','2026-09-21','2029-06-30')
on conflict (id) do nothing;

insert into public.academic_years (student_id, university_id, course, label, study_year, start_date, end_date, status) values
  ('44444444-4444-4444-4444-444444444406','22222222-2222-2222-2222-222222222201','BSc Computer Science','2026/27',1,'2026-09-21','2027-06-30','active'),
  ('44444444-4444-4444-4444-444444444407','22222222-2222-2222-2222-222222222201','BSc Mechanical Engineering','2026/27',1,'2026-09-21','2027-06-30','active')
on conflict do nothing;

-- FUNDING (historical, first-class) -----------------------------------------
insert into public.funding_sources (id, family_id, student_id, kind, label, sponsor, status, start_date) values
  ('55555555-5555-5555-5555-555555555506','11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444406','government_scholarship','Government Scholarship','Ministry of Education','active','2026-01-01'),
  ('55555555-5555-5555-5555-555555555507','11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444407','family_funded','Family Funded','Father','active','2026-01-01')
on conflict (id) do nothing;

insert into public.scholarships (id, student_id, funding_id, sponsor, scholarship_ref, stage, start_date, allowance_note) values
  ('66666666-6666-6666-6666-666666666606','44444444-4444-4444-4444-444444444406','55555555-5555-5555-5555-555555555506','Ministry of Education','GS-2026-HAMZA','active','2026-01-01','Monthly living allowance + tuition covered'),
  ('66666666-6666-6666-6666-666666666607','44444444-4444-4444-4444-444444444407','55555555-5555-5555-5555-555555555507','—','family_funded','2026-01-01',null)
on conflict (id) do nothing;

insert into public.scholarship_requirements (scholarship_id, title, kind, due_date, completed) values
  ('66666666-6666-6666-6666-666666666606','Upload enrollment confirmation','document','2026-10-01',false),
  ('66666666-6666-6666-6666-666666666606','Submit end-of-term academic report','report','2027-01-15',false);

-- CONVERSATIONS -------------------------------------------------------------
insert into public.conversations (id, family_id, kind, title) values
  ('77777777-7777-7777-7777-777777777701','11111111-1111-1111-1111-111111111111','family','Family Chat'),
  ('77777777-7777-7777-7777-777777777702','11111111-1111-1111-1111-111111111111','student','Hamza'),
  ('77777777-7777-7777-7777-777777777703','11111111-1111-1111-1111-111111111111','student','Omar'),
  ('77777777-7777-7777-7777-777777777704','11111111-1111-1111-1111-111111111111','topic','Travel'),
  ('77777777-7777-7777-7777-777777777705','11111111-1111-1111-1111-111111111111','topic','Accommodation')
on conflict (id) do nothing;

insert into public.conversation_members (conversation_id, member_id)
select '77777777-7777-7777-7777-777777777701', id from public.family_members
where family_id = '11111111-1111-1111-1111-111111111111'
on conflict do nothing;

insert into public.messages (id, conversation_id, sender_id, body, pinned) values
  ('88888888-8888-8888-8888-888888888801','77777777-7777-7777-7777-777777777701','33333333-3333-3333-3333-333333333301','Welcome to Family Hub! Everything about Hamza & Omar''s journey lives here.',true),
  ('88888888-8888-8888-8888-888888888802','77777777-7777-7777-7777-777777777701','33333333-3333-3333-3333-333333333307','Dad, I need £350 for books before Thursday.',false),
  ('88888888-8888-8888-8888-888888888803','77777777-7777-7777-7777-777777777701','33333333-3333-3333-3333-333333333302','Omar tuition for this term has been paid ✅',true)
on conflict (id) do nothing;

-- TASKS ---------------------------------------------------------------------
insert into public.tasks (family_id, title, description, assignee_id, student_id, due_date, priority, status) values
  ('11111111-1111-1111-1111-111111111111','Submit scholarship enrollment confirmation','Upload to the scholarship portal','33333333-3333-3333-3333-333333333306','44444444-4444-4444-4444-444444444406', current_date + 6,'important','todo'),
  ('11111111-1111-1111-1111-111111111111','Pay Omar tuition (Term 1)','Bank transfer to university','33333333-3333-3333-3333-333333333301','44444444-4444-4444-4444-444444444407', current_date + 6,'urgent','todo'),
  ('11111111-1111-1111-1111-111111111111','Confirm airport transfer','Arrange pickup from Heathrow','33333333-3333-3333-3333-333333333301',null, current_date + 12,'normal','in_progress'),
  ('11111111-1111-1111-1111-111111111111','Renew travel insurance','Annual renewal','33333333-3333-3333-3333-333333333302',null, current_date - 2,'normal','done');

-- BUDGETS + EXPENSES --------------------------------------------------------
insert into public.budgets (family_id, student_id, month, amount, currency) values
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444406', date_trunc('month',current_date)::date, 900,'GBP'),
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444407', date_trunc('month',current_date)::date, 1100,'GBP')
on conflict do nothing;

insert into public.expenses (family_id, student_id, funding_id, category, amount, currency, spent_on, description) values
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444406','55555555-5555-5555-5555-555555555506','food',180,'GBP',current_date - 5,'Groceries'),
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444406','55555555-5555-5555-5555-555555555506','transport',60,'GBP',current_date - 3,'Bus pass'),
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444407','55555555-5555-5555-5555-555555555507','accommodation',650,'GBP',current_date - 8,'Monthly rent'),
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444407','55555555-5555-5555-5555-555555555507','university',120,'GBP',current_date - 1,'Lab materials');

-- PAYMENT REQUEST (linked to Omar's message) --------------------------------
insert into public.payment_requests (family_id, student_id, amount, currency, reason, category, urgency, requested_by, requested_from, status, source_message_id) values
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444407',350,'GBP','Textbooks for Term 1','university','important','33333333-3333-3333-3333-333333333307','33333333-3333-3333-3333-333333333301','requested','88888888-8888-8888-8888-888888888802');

-- DOCUMENTS -----------------------------------------------------------------
insert into public.documents (family_id, student_id, name, category, visibility, expiry_date, reminder_date, notes) values
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444406','Passport — Hamza','passport','parents_admins','2028-04-10','2028-01-10','Renew well before expiry'),
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444406','Scholarship Letter 2026/27','scholarship','parents_admins',null,null,'Keep every year as a new version'),
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444407','Student Visa — Omar','visa','parents_admins','2029-09-01','2029-06-01',null);

-- TRIPS ---------------------------------------------------------------------
insert into public.trips (id, family_id, title, origin, destination, depart_at, arrive_at) values
  ('99999999-9999-9999-9999-999999999906','11111111-1111-1111-1111-111111111111','Hamza — Travel to UK','Home','London Heathrow', now() + interval '20 days', now() + interval '20 days 7 hours'),
  ('99999999-9999-9999-9999-999999999907','11111111-1111-1111-1111-111111111111','Omar — Travel to UK','Home','London Heathrow', now() + interval '22 days', now() + interval '22 days 7 hours')
on conflict (id) do nothing;
insert into public.trip_members (trip_id, member_id) values
  ('99999999-9999-9999-9999-999999999906','33333333-3333-3333-3333-333333333306'),
  ('99999999-9999-9999-9999-999999999907','33333333-3333-3333-3333-333333333307')
on conflict do nothing;

-- ACCOMMODATION -------------------------------------------------------------
insert into public.accommodations (family_id, student_id, property, address, landlord, start_date, end_date, monthly_rent, deposit, currency, payment_date) values
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444407','Student Halls — Block C','Guildford, Surrey','University Accommodation','2026-09-15','2027-06-30',650,650,'GBP',1);

-- SUPPORT -------------------------------------------------------------------
insert into public.support_categories (id, family_id, kind, name, icon, sort_order) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','11111111-1111-1111-1111-111111111111','recipe','Food Recipes','utensils',1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02','11111111-1111-1111-1111-111111111111','laundry','Laundry','shirt',2),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03','11111111-1111-1111-1111-111111111111','home_basic','Home Basics','home',3),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04','11111111-1111-1111-1111-111111111111','emergency','Emergency & Useful Info','phone',4)
on conflict (id) do nothing;

insert into public.support_guides (id, family_id, category_id, kind, title, description, warnings) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02','laundry','Everyday Clothes','A safe default wash for most everyday clothes.','Check care labels. Don''t mix new dark items with whites.')
on conflict (id) do nothing;
insert into public.support_steps (guide_id, step_no, body) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',1,'Separate lights and darks.'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',2,'Set temperature to 30°C.'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',3,'Add one detergent pod.'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',4,'Select the normal program and start.');

insert into public.recipes (id, family_id, category_id, name, description, category, prep_minutes, cook_minutes, difficulty, servings) values
  ('cccccccc-cccc-cccc-cccc-cccccccccc01','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','Simple Chicken & Rice','A quick, filling one-pan meal.','dinner',10,25,'easy',2)
on conflict (id) do nothing;
insert into public.recipe_ingredients (recipe_id, sort_order, text) values
  ('cccccccc-cccc-cccc-cccc-cccccccccc01',1,'2 chicken breasts, diced'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc01',2,'1 cup rice'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc01',3,'1 onion, chopped'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc01',4,'Salt, pepper, olive oil');
insert into public.recipe_steps (recipe_id, step_no, body) values
  ('cccccccc-cccc-cccc-cccc-cccccccccc01',1,'Fry the onion in olive oil until soft.'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc01',2,'Add chicken and cook until white.'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc01',3,'Add rice and 2 cups water, simmer 20 min covered.');
insert into public.support_audio (scope, recipe_id, storage_path, duration_sec, mime_type)
values ('recipe','cccccccc-cccc-cccc-cccc-cccccccccc01','media/placeholder/voice-note.webm',0,'audio/webm');

-- NOTIFICATIONS -------------------------------------------------------------
insert into public.notifications (family_id, recipient_id, kind, title, body) values
  ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333301','payment_request','New payment request','Omar requested £350 for textbooks'),
  ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333301','task_due','Task due soon','Pay Omar tuition — due in 6 days');

-- CALENDAR ------------------------------------------------------------------
insert into public.calendar_events (family_id, student_id, title, kind, starts_at) values
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444407','Omar tuition due','tuition', now() + interval '6 days'),
  ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444406','Hamza flight to UK','flight', now() + interval '20 days');

commit;

-- Link members to real auth users once they exist (run AFTER creating users):
-- update public.family_members fm set profile_id = u.id
-- from auth.users u where u.email = fm.invite_email and fm.profile_id is null;
