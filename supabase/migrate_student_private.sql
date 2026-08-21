-- Non-destructive migration: private student info (bank/account numbers, phone,
-- address, identity docs). Kept in a SEPARATE table with strict RLS so only
-- admins/parents or the student themselves can read or write it — hiding it in
-- the UI is not enough. Safe to run repeatedly.

create table if not exists public.student_private (
  student_id          uuid primary key references public.student_profiles(id) on delete cascade,
  phone               text,
  address             text,
  emergency_contact   text,
  doctor_gp           text,
  blood_type          text,
  bank_name           text,
  account_number      text,
  sort_code           text,
  iban                text,
  national_insurance  text,
  brp_number          text,   -- Biometric Residence Permit (international students)
  passport_number     text,
  notes               text,
  updated_at          timestamptz not null default now()
);

do $$ begin
  create trigger set_updated_at before update on public.student_private
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

alter table public.student_private enable row level security;

-- True when the current user is an admin/parent in the student's family, or is
-- the student themselves. SECURITY DEFINER to avoid cross-table RLS recursion.
create or replace function public.can_see_student_private(sid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.student_profiles sp
    join public.family_members me on me.family_id = sp.family_id
    where sp.id = sid
      and me.profile_id = auth.uid()
      and me.status = 'active'
      and (me.role in ('admin', 'parent') or me.id = sp.member_id)
  );
$$;

do $$ begin
  create policy "student_private read" on public.student_private
    for select using (public.can_see_student_private(student_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "student_private write" on public.student_private
    for all using (public.can_see_student_private(student_id))
    with check (public.can_see_student_private(student_id));
exception when duplicate_object then null; end $$;
