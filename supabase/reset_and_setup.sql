-- ============================================================================
-- Family Hub — RESET + SETUP (idempotent)
-- Safe to run whether the database is empty, partially set up, or fully set up.
-- It removes any previous Family Hub install, then rebuilds everything cleanly.
-- ============================================================================

-- Remove the auth trigger + function (they live outside the public schema).
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

-- Remove storage policies we may have created previously.
drop policy if exists "docs read own family"   on storage.objects;
drop policy if exists "docs write manage"       on storage.objects;
drop policy if exists "docs delete manage"      on storage.objects;
drop policy if exists "media read own family"   on storage.objects;
drop policy if exists "media write own family"  on storage.objects;
drop policy if exists "media delete own family" on storage.objects;

-- Wipe the public schema entirely (drops all Family Hub tables, types, functions,
-- policies from any prior run) and recreate it with the grants Supabase expects.
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- ============================================================================
-- Fresh setup below
-- ============================================================================

-- Family Hub — Complete database setup (one paste)
-- Runs schema + RLS + reference/auth/storage in order.

-- ============================================================================
-- Family Hub — Schema (0001)
-- Normalized PostgreSQL. UUID PKs. FKs, constraints, indexes, timestamps.
-- Designed for a multi-year family/university journey. Nothing is destructive:
-- funding, academic years, tasks, expenses, documents are historical entities.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Reusable updated_at trigger ------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── ENUMS ──────────────────────────────────────────────────────────────────
create type system_role       as enum ('admin', 'parent', 'student', 'family_member');
create type member_status      as enum ('active', 'invited', 'disabled');
create type task_status        as enum ('todo', 'in_progress', 'done');
create type task_priority      as enum ('normal', 'important', 'urgent');
create type funding_kind       as enum ('government_scholarship', 'family_funded', 'personal', 'other');
create type funding_status     as enum ('active', 'pending', 'ended', 'upcoming');
create type expense_category   as enum ('accommodation','food','transport','university','travel','shopping','entertainment','phone','other');
create type request_status     as enum ('requested','approved','rejected','paid','cancelled');
create type doc_category       as enum ('passport','visa','university','scholarship','accommodation','travel','insurance','banking','academic','other');
create type doc_visibility     as enum ('private_student','parents_admins','selected_members','entire_family');
create type academic_status    as enum ('upcoming','active','completed','deferred');
create type scholarship_stage  as enum ('family_funded','eligibility','application','under_review','approved','active');
create type milestone_kind     as enum ('preparation','arrived','started_university','scholarship_activated','changed_accommodation','completed_year','internship','final_year','graduation','other');
create type student_status     as enum ('preparation','active','graduated','deferred');
create type conversation_kind  as enum ('family','student','topic','group','direct');
create type notification_kind  as enum ('task_due','payment_due','payment_request','payment_approved','document_expiring','trip_approaching','scholarship_deadline','new_message','family_update','system');
create type support_kind       as enum ('recipe','laundry','home_basic','emergency','washing_machine');
create type audio_scope        as enum ('guide','step','recipe','recipe_step');

-- ── IDENTITY & FAMILY ───────────────────────────────────────────────────────
create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Profiles map 1:1 to auth.users
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  avatar_url  text,
  email       text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.roles (
  key         system_role primary key,
  label       text not null,
  description text
);

create table public.permissions (
  key         text primary key,          -- e.g. 'approve_payment_requests'
  label       text not null,
  description text
);

create table public.role_permissions (
  role_key       system_role references public.roles(key) on delete cascade,
  permission_key text references public.permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

-- A person's membership of a family. Relationship != role.
create table public.family_members (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  profile_id     uuid references public.profiles(id) on delete set null, -- null until invite accepted
  display_name   text not null,
  role           system_role not null default 'family_member',
  status         member_status not null default 'active',
  invite_email   text,
  is_student     boolean not null default false,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (family_id, profile_id)
);
create index on public.family_members (family_id);
create index on public.family_members (profile_id);

-- Relationship between two family members (Dad -> Hamza = 'dad')
create table public.family_relationships (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete cascade,
  member_id       uuid not null references public.family_members(id) on delete cascade,
  related_member_id uuid references public.family_members(id) on delete cascade,
  relationship    text not null, -- dad, mom, step_dad, step_mom, brother, sister, son, guardian, grandfather...
  created_at      timestamptz not null default now()
);
create index on public.family_relationships (member_id);

-- Per-member permission overrides (grant/revoke on top of role defaults)
create table public.member_permissions (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.family_members(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  granted        boolean not null default true,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  unique (member_id, permission_key)
);

-- ── UNIVERSITIES & STUDENTS ──────────────────────────────────────────────────
create table public.universities (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  name        text not null,
  city        text,
  country     text default 'United Kingdom',
  website     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.student_profiles (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  member_id      uuid not null references public.family_members(id) on delete cascade,
  university_id  uuid references public.universities(id) on delete set null,
  course         text,
  student_ref    text,
  campus         text,
  start_date     date,
  expected_graduation date,
  advisor        text,
  status         student_status not null default 'preparation',
  overall_status text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (member_id)
);
create index on public.student_profiles (family_id);

create table public.academic_years (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.student_profiles(id) on delete cascade,
  university_id  uuid references public.universities(id) on delete set null,
  course         text,
  label          text not null,          -- '2026/27'
  study_year     int,                    -- 1,2,3,...
  start_date     date,
  end_date       date,
  status         academic_status not null default 'upcoming',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.academic_years (student_id);

create table public.academic_terms (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name             text not null,        -- 'Autumn Term'
  start_date       date,
  end_date         date,
  notes            text,
  created_at       timestamptz not null default now()
);
create index on public.academic_terms (academic_year_id);

create table public.student_milestones (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.student_profiles(id) on delete cascade,
  kind         milestone_kind not null,
  title        text not null,
  description  text,
  occurred_on  date,
  created_at   timestamptz not null default now()
);
create index on public.student_milestones (student_id);

-- ── FUNDING (first-class, historical) ─────────────────────────────────────────
create table public.funding_sources (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  student_id   uuid not null references public.student_profiles(id) on delete cascade,
  kind         funding_kind not null,
  label        text not null,            -- 'Government Scholarship'
  sponsor      text,
  status       funding_status not null default 'active',
  start_date   date not null,
  end_date     date,                     -- null = ongoing; set when a period ends
  notes        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.funding_sources (student_id);

create table public.scholarships (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.student_profiles(id) on delete cascade,
  funding_id    uuid references public.funding_sources(id) on delete set null,
  sponsor       text,
  scholarship_ref text,
  stage         scholarship_stage not null default 'active',
  start_date    date,
  end_date      date,
  allowance_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.scholarships (student_id);

create table public.scholarship_requirements (
  id             uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  title          text not null,
  kind           text,                   -- 'document' | 'report' | 'academic'
  due_date       date,
  completed       boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now()
);
create index on public.scholarship_requirements (scholarship_id);

-- ── TASKS ─────────────────────────────────────────────────────────────────────
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  title         text not null,
  description   text,
  assignee_id   uuid references public.family_members(id) on delete set null,
  student_id    uuid references public.student_profiles(id) on delete set null,
  due_date      date,
  priority      task_priority not null default 'normal',
  status        task_status not null default 'todo',
  attachment_url text,
  source_message_id uuid,                -- link back to a chat message (set later)
  created_by    uuid references public.profiles(id),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.tasks (family_id, status);
create index on public.tasks (assignee_id);
create index on public.tasks (student_id);

create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  author_id  uuid references public.profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index on public.task_comments (task_id);

create table public.task_recurrences (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  frequency   text not null,             -- 'monthly','yearly','termly','custom'
  interval_n  int not null default 1,
  next_run    date,
  active       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── CHAT ───────────────────────────────────────────────────────────────────────
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  kind        conversation_kind not null default 'group',
  title       text not null,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.conversations (family_id);

create table public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  member_id       uuid references public.family_members(id) on delete cascade,
  last_read_at    timestamptz,
  primary key (conversation_id, member_id)
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references public.family_members(id) on delete set null,
  body            text,
  reply_to_id     uuid references public.messages(id) on delete set null,
  pinned          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at desc);

create table public.message_attachments (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  storage_path text not null,
  file_name   text,
  mime_type   text,
  size_bytes  bigint,
  created_at  timestamptz not null default now()
);
create index on public.message_attachments (message_id);

create table public.message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  member_id   uuid not null references public.family_members(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (message_id, member_id, emoji)
);

create table public.message_reads (
  message_id  uuid references public.messages(id) on delete cascade,
  member_id   uuid references public.family_members(id) on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (message_id, member_id)
);

-- ── MONEY ────────────────────────────────────────────────────────────────────
create table public.budgets (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  student_id    uuid references public.student_profiles(id) on delete cascade,
  month         date not null,           -- first day of the month
  amount        numeric(12,2) not null default 0,
  currency      text not null default 'GBP',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (student_id, month)
);

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  student_id    uuid references public.student_profiles(id) on delete set null,
  funding_id    uuid references public.funding_sources(id) on delete set null,
  category      expense_category not null default 'other',
  amount        numeric(12,2) not null,
  currency      text not null default 'GBP',
  spent_on      date not null default current_date,
  description   text,
  notes         text,
  receipt_path  text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.expenses (student_id, spent_on desc);
create index on public.expenses (funding_id);

create table public.payment_requests (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  student_id    uuid references public.student_profiles(id) on delete set null,
  amount        numeric(12,2) not null,
  currency      text not null default 'GBP',
  reason        text not null,
  category      expense_category not null default 'other',
  urgency       task_priority not null default 'normal',
  note          text,
  attachment_path text,
  requested_by  uuid references public.family_members(id) on delete set null,
  requested_from uuid references public.family_members(id) on delete set null,
  status        request_status not null default 'requested',
  source_message_id uuid references public.messages(id) on delete set null,
  decided_by    uuid references public.profiles(id),
  decided_at    timestamptz,
  paid_expense_id uuid references public.expenses(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.payment_requests (family_id, status);
create index on public.payment_requests (student_id);

-- ── DOCUMENTS (private, versioned) ───────────────────────────────────────────
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  student_id    uuid references public.student_profiles(id) on delete set null,
  name          text not null,
  category      doc_category not null default 'other',
  visibility    doc_visibility not null default 'parents_admins',
  expiry_date   date,
  reminder_date date,
  notes         text,
  uploaded_by   uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.documents (family_id, category);
create index on public.documents (student_id);

create table public.document_versions (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.documents(id) on delete cascade,
  version       int not null default 1,
  storage_path  text not null,
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  unique (document_id, version)
);

-- selected-member visibility for documents
create table public.document_shares (
  document_id  uuid references public.documents(id) on delete cascade,
  member_id    uuid references public.family_members(id) on delete cascade,
  primary key (document_id, member_id)
);

-- ── TRAVEL & ACCOMMODATION ────────────────────────────────────────────────────
create table public.trips (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  title         text not null,
  origin        text,
  destination   text,
  depart_at     timestamptz,
  arrive_at     timestamptz,
  dest_address  text,
  transfer_note text,
  notes         text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.trips (family_id, depart_at);

create table public.trip_members (
  trip_id   uuid references public.trips(id) on delete cascade,
  member_id uuid references public.family_members(id) on delete cascade,
  primary key (trip_id, member_id)
);

create table public.flights (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  airline       text,
  flight_number text,
  booking_ref   text,
  terminal      text,
  seat          text,
  baggage       text,
  ticket_path   text,
  depart_airport text,
  arrive_airport text,
  depart_at     timestamptz,
  arrive_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.flights (trip_id);

create table public.accommodations (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  student_id    uuid references public.student_profiles(id) on delete set null,
  property      text not null,
  address       text,
  landlord      text,
  contact       text,
  start_date    date,
  end_date      date,
  monthly_rent  numeric(12,2),
  deposit       numeric(12,2),
  currency      text not null default 'GBP',
  payment_date  int,                     -- day of month
  contract_path text,
  wifi_info     text,
  utility_notes text,
  maintenance_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.accommodations (student_id, start_date desc);

create table public.accommodation_photos (
  id               uuid primary key default gen_random_uuid(),
  accommodation_id uuid not null references public.accommodations(id) on delete cascade,
  storage_path     text not null,
  caption          text,
  created_at       timestamptz not null default now()
);

-- ── CALENDAR & NOTIFICATIONS ──────────────────────────────────────────────────
create table public.calendar_events (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  student_id    uuid references public.student_profiles(id) on delete set null,
  title         text not null,
  kind          text not null default 'general', -- flight,rent,tuition,deadline,visa,doc_expiry,travel
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  source_table  text,                    -- polymorphic soft-link
  source_id     uuid,
  created_at    timestamptz not null default now()
);
create index on public.calendar_events (family_id, starts_at);

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  recipient_id  uuid not null references public.family_members(id) on delete cascade,
  kind          notification_kind not null,
  title         text not null,
  body          text,
  link          text,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.notifications (recipient_id, read_at);

create table public.notification_preferences (
  member_id   uuid primary key references public.family_members(id) on delete cascade,
  prefs       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ── SUPPORT (recipes, laundry, home basics) ───────────────────────────────────
create table public.support_categories (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  kind        support_kind not null,
  name        text not null,
  icon        text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.support_guides (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  category_id   uuid references public.support_categories(id) on delete set null,
  kind          support_kind not null,
  title         text not null,
  description   text,
  cover_path    text,
  warnings      text,
  is_apartment_specific boolean not null default false,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.support_guides (family_id, kind);

create table public.support_steps (
  id          uuid primary key default gen_random_uuid(),
  guide_id    uuid not null references public.support_guides(id) on delete cascade,
  step_no     int not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index on public.support_steps (guide_id, step_no);

create table public.support_media (
  id          uuid primary key default gen_random_uuid(),
  guide_id    uuid references public.support_guides(id) on delete cascade,
  step_id     uuid references public.support_steps(id) on delete cascade,
  storage_path text not null,
  caption     text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.support_audio (
  id          uuid primary key default gen_random_uuid(),
  scope       audio_scope not null,
  guide_id    uuid references public.support_guides(id) on delete cascade,
  step_id     uuid references public.support_steps(id) on delete cascade,
  recipe_id   uuid,                      -- FK added after recipes table
  recipe_step_id uuid,
  storage_path text not null,
  duration_sec numeric(8,2),
  mime_type   text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  category_id   uuid references public.support_categories(id) on delete set null,
  name          text not null,
  description   text,
  cover_path    text,
  category      text,                    -- breakfast,lunch,dinner,snacks,quick,family_favorites
  prep_minutes  int,
  cook_minutes  int,
  difficulty    text,                    -- easy,medium,hard
  servings      int,
  notes         text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.recipes (family_id);

create table public.recipe_ingredients (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  sort_order  int not null default 0,
  text        text not null,
  created_at  timestamptz not null default now()
);

create table public.recipe_steps (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  step_no     int not null,
  body        text not null,
  image_path  text,
  created_at  timestamptz not null default now()
);

create table public.recipe_media (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  storage_path text not null,
  caption     text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.recipe_favorites (
  recipe_id   uuid references public.recipes(id) on delete cascade,
  member_id   uuid references public.family_members(id) on delete cascade,
  primary key (recipe_id, member_id)
);

alter table public.support_audio
  add constraint support_audio_recipe_fk
  foreign key (recipe_id) references public.recipes(id) on delete cascade;
alter table public.support_audio
  add constraint support_audio_recipe_step_fk
  foreign key (recipe_step_id) references public.recipe_steps(id) on delete cascade;

-- link tasks back to messages now that messages exists
alter table public.tasks
  add constraint tasks_source_message_fk
  foreign key (source_message_id) references public.messages(id) on delete set null;

-- ── AUDIT LOG ─────────────────────────────────────────────────────────────────
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid references public.families(id) on delete cascade,
  actor_id    uuid references public.profiles(id),
  action      text not null,            -- 'payment.approve','funding.change','document.delete'...
  entity      text,
  entity_id   uuid,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index on public.audit_logs (family_id, created_at desc);

-- ── updated_at triggers ───────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'families','profiles','family_members','universities','student_profiles',
    'academic_years','funding_sources','scholarships','tasks','conversations',
    'messages','budgets','expenses','payment_requests','documents','trips',
    'accommodations','support_guides','recipes'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ============================================================================
-- Family Hub — Row Level Security (0002)
-- RLS is MANDATORY. No permissive dev policies. Storage mirrors DB permissions.
-- ============================================================================

-- ── Helper functions (SECURITY DEFINER, stable) ──────────────────────────────

-- The family_member row for the current auth user in a given family.
create or replace function public.current_member(fam uuid)
returns public.family_members
language sql stable security definer set search_path = public as $$
  select * from public.family_members
  where family_id = fam and profile_id = auth.uid() and status = 'active'
  limit 1;
$$;

-- Is the current user an active member of this family?
create or replace function public.is_family_member(fam uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members
    where family_id = fam and profile_id = auth.uid() and status = 'active'
  );
$$;

-- Resolve a permission for the current user in a family:
-- per-member override wins, else role default.
create or replace function public.has_perm(fam uuid, perm text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  m public.family_members;
  override boolean;
  role_default boolean;
begin
  select * into m from public.family_members
   where family_id = fam and profile_id = auth.uid() and status = 'active' limit 1;
  if m.id is null then return false; end if;
  if m.role = 'admin' then return true; end if;

  select granted into override from public.member_permissions
   where member_id = m.id and permission_key = perm limit 1;
  if override is not null then return override; end if;

  select true into role_default from public.role_permissions
   where role_key = m.role and permission_key = perm limit 1;
  return coalesce(role_default, false);
end $$;

-- Is the current user a parent/admin of the family?
create or replace function public.is_parent_admin(fam uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members
    where family_id = fam and profile_id = auth.uid()
      and status = 'active' and role in ('admin','parent')
  );
$$;

-- The student_profile owned by the current user (if any).
create or replace function public.owns_student(student uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.student_profiles sp
    join public.family_members fm on fm.id = sp.member_id
    where sp.id = student and fm.profile_id = auth.uid()
  );
$$;

-- Is the current user a member of a conversation?
create or replace function public.in_conversation(conv uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.conversation_members cm
    join public.family_members fm on fm.id = cm.member_id
    where cm.conversation_id = conv and fm.profile_id = auth.uid()
      and fm.status = 'active'
  );
$$;

-- ── Enable RLS on every table ─────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'families','profiles','family_members','family_relationships','member_permissions',
    'universities','student_profiles','academic_years','academic_terms','student_milestones',
    'funding_sources','scholarships','scholarship_requirements','tasks','task_comments',
    'task_recurrences','conversations','conversation_members','messages','message_attachments',
    'message_reactions','message_reads','budgets','expenses','payment_requests','documents',
    'document_versions','document_shares','trips','trip_members','flights','accommodations',
    'accommodation_photos','calendar_events','notifications','notification_preferences',
    'support_categories','support_guides','support_steps','support_media','support_audio',
    'recipes','recipe_ingredients','recipe_steps','recipe_media','recipe_favorites','audit_logs'
  ] loop
    -- ENABLE (not FORCE): FORCE would subject the table owner to RLS too, which
    -- makes SECURITY DEFINER helper policies recurse infinitely on managed
    -- Postgres (where the owner is not a superuser). ENABLE fully protects the
    -- anon/authenticated roles the app actually uses.
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- Reference tables readable by any authenticated user
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
create policy "roles readable" on public.roles for select to authenticated using (true);
create policy "perms readable" on public.permissions for select to authenticated using (true);
create policy "role_perms readable" on public.role_permissions for select to authenticated using (true);

-- ── PROFILES ──────────────────────────────────────────────────────────────────
create policy "own profile read"   on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert with check (id = auth.uid());
-- family members can see each other's profiles
create policy "family profiles read" on public.profiles for select using (
  exists (
    select 1 from public.family_members me
    join public.family_members them on them.family_id = me.family_id
    where me.profile_id = auth.uid() and them.profile_id = public.profiles.id
  )
);

-- ── FAMILIES ──────────────────────────────────────────────────────────────────
create policy "family read"   on public.families for select using (public.is_family_member(id));
create policy "family update" on public.families for update using (public.has_perm(id, 'manage_family_members'));

-- ── FAMILY MEMBERS ────────────────────────────────────────────────────────────
create policy "members read"   on public.family_members for select using (public.is_family_member(family_id));
create policy "members insert" on public.family_members for insert with check (public.has_perm(family_id,'manage_family_members'));
create policy "members update" on public.family_members for update using (public.has_perm(family_id,'manage_family_members'));
create policy "members delete" on public.family_members for delete using (public.has_perm(family_id,'manage_family_members'));

create policy "relationships read"  on public.family_relationships for select using (public.is_family_member(family_id));
create policy "relationships write" on public.family_relationships for all
  using (public.has_perm(family_id,'manage_family_members'))
  with check (public.has_perm(family_id,'manage_family_members'));

create policy "member_perms read" on public.member_permissions for select using (
  exists (select 1 from public.family_members fm where fm.id = member_id and public.is_family_member(fm.family_id))
);
create policy "member_perms write" on public.member_permissions for all using (
  exists (select 1 from public.family_members fm where fm.id = member_id and public.has_perm(fm.family_id,'manage_permissions'))
) with check (
  exists (select 1 from public.family_members fm where fm.id = member_id and public.has_perm(fm.family_id,'manage_permissions'))
);

-- ── Generic helpers for family-scoped tables ──────────────────────────────────
-- Most content tables: read = family member, write = family member (feature perms
-- enforced at the app/server layer + finer policies below for sensitive ones).

-- universities, student_profiles, academic_*, milestones
create policy "uni read"  on public.universities for select using (public.is_family_member(family_id));
create policy "uni write" on public.universities for all using (public.is_parent_admin(family_id)) with check (public.is_parent_admin(family_id));

create policy "student read" on public.student_profiles for select using (public.is_family_member(family_id));
create policy "student write" on public.student_profiles for all using (public.is_parent_admin(family_id)) with check (public.is_parent_admin(family_id));

create policy "acadyear read" on public.academic_years for select using (
  exists (select 1 from public.student_profiles sp where sp.id = student_id and public.is_family_member(sp.family_id)));
create policy "acadyear write" on public.academic_years for all using (
  exists (select 1 from public.student_profiles sp where sp.id = student_id and public.is_parent_admin(sp.family_id)))
  with check (exists (select 1 from public.student_profiles sp where sp.id = student_id and public.is_parent_admin(sp.family_id)));

create policy "term read" on public.academic_terms for select using (
  exists (select 1 from public.academic_years ay join public.student_profiles sp on sp.id=ay.student_id
          where ay.id = academic_year_id and public.is_family_member(sp.family_id)));
create policy "term write" on public.academic_terms for all using (
  exists (select 1 from public.academic_years ay join public.student_profiles sp on sp.id=ay.student_id
          where ay.id = academic_year_id and public.is_parent_admin(sp.family_id)))
  with check (true);

create policy "milestone read" on public.student_milestones for select using (
  exists (select 1 from public.student_profiles sp where sp.id = student_id and public.is_family_member(sp.family_id)));
create policy "milestone write" on public.student_milestones for all using (
  exists (select 1 from public.student_profiles sp where sp.id = student_id and public.is_parent_admin(sp.family_id)))
  with check (true);

-- ── FUNDING (sensitive: finance permission) ───────────────────────────────────
create policy "funding read" on public.funding_sources for select using (
  public.has_perm(family_id,'view_student_finances')
  or public.owns_student(student_id)
);
create policy "funding write" on public.funding_sources for all
  using (public.has_perm(family_id,'manage_student_finances'))
  with check (public.has_perm(family_id,'manage_student_finances'));

create policy "scholarship read" on public.scholarships for select using (
  exists (select 1 from public.student_profiles sp where sp.id = student_id
          and (public.has_perm(sp.family_id,'view_scholarship') or public.owns_student(student_id))));
create policy "scholarship write" on public.scholarships for all using (
  exists (select 1 from public.student_profiles sp where sp.id = student_id and public.has_perm(sp.family_id,'manage_scholarship')))
  with check (true);

create policy "schol_req read" on public.scholarship_requirements for select using (
  exists (select 1 from public.scholarships s join public.student_profiles sp on sp.id=s.student_id
          where s.id = scholarship_id and (public.has_perm(sp.family_id,'view_scholarship') or public.owns_student(s.student_id))));
create policy "schol_req write" on public.scholarship_requirements for all using (
  exists (select 1 from public.scholarships s join public.student_profiles sp on sp.id=s.student_id
          where s.id = scholarship_id and public.has_perm(sp.family_id,'manage_scholarship')))
  with check (true);

-- ── TASKS ─────────────────────────────────────────────────────────────────────
create policy "task read"   on public.tasks for select using (public.is_family_member(family_id));
create policy "task insert" on public.tasks for insert with check (public.is_family_member(family_id));
create policy "task update" on public.tasks for update using (
  public.is_parent_admin(family_id)
  or created_by = auth.uid()
  or assignee_id in (select id from public.family_members where profile_id = auth.uid())
);
create policy "task delete" on public.tasks for delete using (public.is_parent_admin(family_id) or created_by = auth.uid());

create policy "task_comment read" on public.task_comments for select using (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_family_member(t.family_id)));
create policy "task_comment write" on public.task_comments for insert with check (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_family_member(t.family_id)));

create policy "task_recur all" on public.task_recurrences for all using (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_parent_admin(t.family_id)))
  with check (true);

-- ── CHAT (membership-gated) ───────────────────────────────────────────────────
create policy "conv read"   on public.conversations for select using (public.in_conversation(id));
create policy "conv insert" on public.conversations for insert with check (public.is_family_member(family_id) and public.has_perm(family_id,'send_family_messages'));
create policy "conv update" on public.conversations for update using (public.is_parent_admin(family_id) or created_by = auth.uid());

create policy "conv_member read" on public.conversation_members for select using (public.in_conversation(conversation_id));
create policy "conv_member write" on public.conversation_members for all using (
  exists (select 1 from public.conversations c where c.id = conversation_id and (public.is_parent_admin(c.family_id) or c.created_by = auth.uid())))
  with check (true);

create policy "msg read" on public.messages for select using (public.in_conversation(conversation_id));
create policy "msg insert" on public.messages for insert with check (
  public.in_conversation(conversation_id)
  and sender_id in (select id from public.family_members where profile_id = auth.uid())
);
create policy "msg update" on public.messages for update using (
  sender_id in (select id from public.family_members where profile_id = auth.uid())
  or exists (select 1 from public.conversations c where c.id = conversation_id and public.is_parent_admin(c.family_id))
);

create policy "msg_attach read" on public.message_attachments for select using (
  exists (select 1 from public.messages m where m.id = message_id and public.in_conversation(m.conversation_id)));
create policy "msg_attach write" on public.message_attachments for insert with check (
  exists (select 1 from public.messages m where m.id = message_id and public.in_conversation(m.conversation_id)));

create policy "reaction read" on public.message_reactions for select using (
  exists (select 1 from public.messages m where m.id = message_id and public.in_conversation(m.conversation_id)));
create policy "reaction write" on public.message_reactions for all using (
  member_id in (select id from public.family_members where profile_id = auth.uid()))
  with check (exists (select 1 from public.messages m where m.id = message_id and public.in_conversation(m.conversation_id)));

create policy "reads read" on public.message_reads for select using (
  exists (select 1 from public.messages m where m.id = message_id and public.in_conversation(m.conversation_id)));
create policy "reads write" on public.message_reads for all using (
  member_id in (select id from public.family_members where profile_id = auth.uid()))
  with check (member_id in (select id from public.family_members where profile_id = auth.uid()));

-- ── MONEY (finance-permission gated; students see only their own) ─────────────
create policy "budget read" on public.budgets for select using (
  public.has_perm(family_id,'view_student_finances') or public.owns_student(student_id));
create policy "budget write" on public.budgets for all using (public.has_perm(family_id,'manage_student_finances')) with check (public.has_perm(family_id,'manage_student_finances'));

create policy "expense read" on public.expenses for select using (
  public.has_perm(family_id,'view_student_finances') or public.owns_student(student_id));
create policy "expense write" on public.expenses for all using (public.has_perm(family_id,'manage_student_finances')) with check (public.has_perm(family_id,'manage_student_finances'));

-- payment requests: student can create/see own; approvers manage
create policy "preq read" on public.payment_requests for select using (
  public.has_perm(family_id,'view_student_finances')
  or public.owns_student(student_id)
  or requested_by in (select id from public.family_members where profile_id = auth.uid())
);
create policy "preq insert" on public.payment_requests for insert with check (
  requested_by in (select id from public.family_members where profile_id = auth.uid())
  and public.is_family_member(family_id)
);
create policy "preq update" on public.payment_requests for update using (
  public.has_perm(family_id,'approve_payment_requests')
  or (status = 'requested' and requested_by in (select id from public.family_members where profile_id = auth.uid()))
);

-- ── DOCUMENTS (private; visibility rules) ─────────────────────────────────────
-- SECURITY DEFINER so checking document_shares here does NOT trigger the
-- document_shares policy (which reads documents) — that mutual reference would
-- otherwise cause infinite recursion (42P17) on any documents read.
create or replace function public.doc_shared_with_me(doc uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.document_shares ds
    join public.family_members fm on fm.id = ds.member_id
    where ds.document_id = doc and fm.profile_id = auth.uid()
  );
$$;

create policy "doc read" on public.documents for select using (
  public.has_perm(family_id,'manage_documents')
  or (visibility = 'entire_family' and public.has_perm(family_id,'view_documents'))
  or (visibility = 'parents_admins' and public.is_parent_admin(family_id))
  or (visibility = 'private_student' and public.owns_student(student_id))
  or (visibility = 'selected_members' and public.doc_shared_with_me(id))
);
create policy "doc write" on public.documents for all using (public.has_perm(family_id,'manage_documents')) with check (public.has_perm(family_id,'manage_documents'));

create policy "docver read" on public.document_versions for select using (
  exists (select 1 from public.documents d where d.id = document_id and (
    public.has_perm(d.family_id,'manage_documents')
    or (d.visibility='entire_family' and public.has_perm(d.family_id,'view_documents'))
    or (d.visibility='parents_admins' and public.is_parent_admin(d.family_id))
    or (d.visibility='private_student' and public.owns_student(d.student_id))
  )));
create policy "docver write" on public.document_versions for all using (
  exists (select 1 from public.documents d where d.id = document_id and public.has_perm(d.family_id,'manage_documents')))
  with check (true);
create policy "docshare all" on public.document_shares for all using (
  exists (select 1 from public.documents d where d.id = document_id and public.has_perm(d.family_id,'manage_documents')))
  with check (true);

-- ── TRAVEL & ACCOMMODATION ────────────────────────────────────────────────────
create policy "trip read" on public.trips for select using (public.is_family_member(family_id));
create policy "trip write" on public.trips for all using (public.has_perm(family_id,'manage_travel')) with check (public.has_perm(family_id,'manage_travel'));
create policy "tripmem read" on public.trip_members for select using (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_family_member(t.family_id)));
create policy "tripmem write" on public.trip_members for all using (
  exists (select 1 from public.trips t where t.id = trip_id and public.has_perm(t.family_id,'manage_travel'))) with check (true);
create policy "flight read" on public.flights for select using (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_family_member(t.family_id)));
create policy "flight write" on public.flights for all using (
  exists (select 1 from public.trips t where t.id = trip_id and public.has_perm(t.family_id,'manage_travel'))) with check (true);

create policy "accom read" on public.accommodations for select using (public.is_family_member(family_id));
create policy "accom write" on public.accommodations for all using (public.is_parent_admin(family_id)) with check (public.is_parent_admin(family_id));
create policy "accomphoto read" on public.accommodation_photos for select using (
  exists (select 1 from public.accommodations a where a.id = accommodation_id and public.is_family_member(a.family_id)));
create policy "accomphoto write" on public.accommodation_photos for all using (
  exists (select 1 from public.accommodations a where a.id = accommodation_id and public.is_parent_admin(a.family_id))) with check (true);

-- ── CALENDAR & NOTIFICATIONS ──────────────────────────────────────────────────
create policy "cal read" on public.calendar_events for select using (public.is_family_member(family_id));
create policy "cal write" on public.calendar_events for all using (public.is_parent_admin(family_id)) with check (public.is_parent_admin(family_id));

create policy "notif read" on public.notifications for select using (
  recipient_id in (select id from public.family_members where profile_id = auth.uid()));
create policy "notif update" on public.notifications for update using (
  recipient_id in (select id from public.family_members where profile_id = auth.uid()));
create policy "notif insert" on public.notifications for insert with check (public.is_family_member(family_id));

create policy "notifpref all" on public.notification_preferences for all using (
  member_id in (select id from public.family_members where profile_id = auth.uid()))
  with check (member_id in (select id from public.family_members where profile_id = auth.uid()));

-- ── SUPPORT (readable by all family; write needs support perms) ───────────────
create policy "supcat read" on public.support_categories for select using (public.is_family_member(family_id));
create policy "supcat write" on public.support_categories for all using (public.has_perm(family_id,'edit_support')) with check (public.has_perm(family_id,'edit_support'));

create policy "guide read" on public.support_guides for select using (public.has_perm(family_id,'view_support'));
create policy "guide write" on public.support_guides for all using (public.has_perm(family_id,'create_support')) with check (public.has_perm(family_id,'create_support'));

create policy "step read" on public.support_steps for select using (
  exists (select 1 from public.support_guides g where g.id = guide_id and public.has_perm(g.family_id,'view_support')));
create policy "step write" on public.support_steps for all using (
  exists (select 1 from public.support_guides g where g.id = guide_id and public.has_perm(g.family_id,'edit_support'))) with check (true);

create policy "supmedia read" on public.support_media for select using (
  exists (select 1 from public.support_guides g where g.id = guide_id and public.has_perm(g.family_id,'view_support')));
create policy "supmedia write" on public.support_media for all using (
  exists (select 1 from public.support_guides g where g.id = guide_id and public.has_perm(g.family_id,'edit_support'))) with check (true);

create policy "supaudio read" on public.support_audio for select to authenticated using (true);
create policy "supaudio write" on public.support_audio for all to authenticated using (true) with check (true);

create policy "recipe read" on public.recipes for select using (public.has_perm(family_id,'view_support'));
create policy "recipe write" on public.recipes for all using (public.has_perm(family_id,'create_support')) with check (public.has_perm(family_id,'create_support'));
create policy "ring read" on public.recipe_ingredients for select using (
  exists (select 1 from public.recipes r where r.id = recipe_id and public.has_perm(r.family_id,'view_support')));
create policy "ring write" on public.recipe_ingredients for all using (
  exists (select 1 from public.recipes r where r.id = recipe_id and public.has_perm(r.family_id,'edit_support'))) with check (true);
create policy "rstep read" on public.recipe_steps for select using (
  exists (select 1 from public.recipes r where r.id = recipe_id and public.has_perm(r.family_id,'view_support')));
create policy "rstep write" on public.recipe_steps for all using (
  exists (select 1 from public.recipes r where r.id = recipe_id and public.has_perm(r.family_id,'edit_support'))) with check (true);
create policy "rmedia read" on public.recipe_media for select using (
  exists (select 1 from public.recipes r where r.id = recipe_id and public.has_perm(r.family_id,'view_support')));
create policy "rmedia write" on public.recipe_media for all using (
  exists (select 1 from public.recipes r where r.id = recipe_id and public.has_perm(r.family_id,'edit_support'))) with check (true);
create policy "rfav all" on public.recipe_favorites for all using (
  member_id in (select id from public.family_members where profile_id = auth.uid()))
  with check (member_id in (select id from public.family_members where profile_id = auth.uid()));

-- ── AUDIT LOGS (read by admins; insert by any family member via app) ──────────
create policy "audit read" on public.audit_logs for select using (public.is_parent_admin(family_id));
create policy "audit insert" on public.audit_logs for insert with check (public.is_family_member(family_id));

-- ============================================================================
-- Family Hub — Reference data, auth trigger, storage (0003)
-- ============================================================================

-- ── Roles ─────────────────────────────────────────────────────────────────────
insert into public.roles (key, label, description) values
  ('admin','Admin','Full administrative access to the family hub'),
  ('parent','Parent','Parent access; finance/document permissions configurable'),
  ('student','Student','Student access to their own information'),
  ('family_member','Family Member','General family access without sensitive data by default')
on conflict (key) do nothing;

-- ── Permissions ───────────────────────────────────────────────────────────────
insert into public.permissions (key, label, description) values
  ('view_family_chat','View family chat',null),
  ('send_family_messages','Send family messages',null),
  ('view_student_profile','View student profiles',null),
  ('view_student_finances','View student finances',null),
  ('manage_student_finances','Manage student finances',null),
  ('approve_payment_requests','Approve payment requests',null),
  ('view_documents','View documents',null),
  ('manage_documents','Manage documents',null),
  ('view_travel','View travel',null),
  ('manage_travel','Manage travel',null),
  ('view_scholarship','View scholarship',null),
  ('manage_scholarship','Manage scholarship',null),
  ('view_support','View support guides',null),
  ('create_support','Create support guides',null),
  ('edit_support','Edit support guides',null),
  ('manage_family_members','Manage family members',null),
  ('manage_permissions','Manage permissions',null)
on conflict (key) do nothing;

-- ── Role → permission defaults ────────────────────────────────────────────────
-- admin: all (handled in code too, but grant explicitly)
insert into public.role_permissions (role_key, permission_key)
select 'admin', key from public.permissions on conflict do nothing;

-- parent: broad, minus permission management; finances configurable (granted by default)
insert into public.role_permissions (role_key, permission_key) values
  ('parent','view_family_chat'),('parent','send_family_messages'),
  ('parent','view_student_profile'),('parent','view_student_finances'),
  ('parent','manage_student_finances'),('parent','approve_payment_requests'),
  ('parent','view_documents'),('parent','manage_documents'),
  ('parent','view_travel'),('parent','manage_travel'),
  ('parent','view_scholarship'),('parent','manage_scholarship'),
  ('parent','view_support'),('parent','create_support'),('parent','edit_support'),
  ('parent','manage_family_members')
on conflict do nothing;

-- student: own info + chat + support; NO cross-student finance
insert into public.role_permissions (role_key, permission_key) values
  ('student','view_family_chat'),('student','send_family_messages'),
  ('student','view_student_profile'),('student','view_travel'),
  ('student','view_documents'),('student','view_scholarship'),
  ('student','view_support'),('student','create_support')
on conflict do nothing;

-- family_member: chat + support, no finances by default
insert into public.role_permissions (role_key, permission_key) values
  ('family_member','view_family_chat'),('family_member','send_family_messages'),
  ('family_member','view_student_profile'),('family_member','view_travel'),
  ('family_member','view_support')
on conflict do nothing;

-- ── Auto-create a profile when a new auth user signs up ───────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Storage buckets (private) ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values
  ('documents','documents', false),
  ('media','media', false)
on conflict (id) do nothing;

-- Storage RLS: authenticated family users may read/write within their family folder.
-- Convention: object path is '<family_id>/<...>'. App enforces finer rules; signed
-- URLs are used for delivery. These policies mirror DB access at the coarse level.
create policy "docs read own family"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents'
         and public.is_family_member((split_part(name,'/',1))::uuid));
create policy "docs write manage"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
         and public.has_perm((split_part(name,'/',1))::uuid,'manage_documents'));
create policy "docs delete manage"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents'
         and public.has_perm((split_part(name,'/',1))::uuid,'manage_documents'));

create policy "media read own family"
  on storage.objects for select to authenticated
  using (bucket_id = 'media'
         and public.is_family_member((split_part(name,'/',1))::uuid));
create policy "media write own family"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media'
         and public.is_family_member((split_part(name,'/',1))::uuid));
create policy "media delete own family"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media'
         and public.is_family_member((split_part(name,'/',1))::uuid));
