-- Non-destructive migration: per-student move/pre-departure checklist.
-- A simple ticklist of things to sort before a student travels (visa, bank,
-- SIM, insurance, deposit, packing, …). Safe to re-run.

create table if not exists public.student_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  student_id  uuid not null references public.student_profiles(id) on delete cascade,
  title       text not null,
  category    text not null default 'other',
  done        boolean not null default false,
  due_date    date,
  sort_order  int not null default 0,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists checklist_student_idx on public.student_checklist_items (student_id);

alter table public.student_checklist_items enable row level security;

-- Family members can read and tick/add items; delete limited to creator or parent/admin.
drop policy if exists "checklist read"   on public.student_checklist_items;
create policy "checklist read"   on public.student_checklist_items for select using (public.is_family_member(family_id));
drop policy if exists "checklist insert" on public.student_checklist_items;
create policy "checklist insert" on public.student_checklist_items for insert with check (public.is_family_member(family_id));
drop policy if exists "checklist update" on public.student_checklist_items;
create policy "checklist update" on public.student_checklist_items for update using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
drop policy if exists "checklist delete" on public.student_checklist_items;
create policy "checklist delete" on public.student_checklist_items for delete using (public.is_parent_admin(family_id) or created_by = auth.uid());
