-- Non-destructive migration: multiple assignees & related students per task.
--
-- Adds join tables alongside the existing tasks.assignee_id / student_id
-- columns (which stay populated with the "primary" pick for backward
-- compatibility). Backfills from the current single values. Safe to re-run.

create table if not exists public.task_assignees (
  task_id   uuid not null references public.tasks(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  primary key (task_id, member_id)
);
create index if not exists task_assignees_member_idx on public.task_assignees (member_id);

create table if not exists public.task_students (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  primary key (task_id, student_id)
);
create index if not exists task_students_student_idx on public.task_students (student_id);

alter table public.task_assignees enable row level security;
alter table public.task_students  enable row level security;

-- Access mirrors the parent task's family (same as task_comments).
drop policy if exists "task_assignees read"  on public.task_assignees;
create policy "task_assignees read" on public.task_assignees for select using (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_family_member(t.family_id)));
drop policy if exists "task_assignees write" on public.task_assignees;
create policy "task_assignees write" on public.task_assignees for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_family_member(t.family_id)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.is_family_member(t.family_id)));

drop policy if exists "task_students read"  on public.task_students;
create policy "task_students read" on public.task_students for select using (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_family_member(t.family_id)));
drop policy if exists "task_students write" on public.task_students;
create policy "task_students write" on public.task_students for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_family_member(t.family_id)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.is_family_member(t.family_id)));

-- Backfill from the existing single columns so nothing is lost.
insert into public.task_assignees (task_id, member_id)
  select id, assignee_id from public.tasks where assignee_id is not null
  on conflict do nothing;
insert into public.task_students (task_id, student_id)
  select id, student_id from public.tasks where student_id is not null
  on conflict do nothing;
