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
