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

-- ── Realtime: broadcast new chat messages (+ reactions/reads) ─────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null; when undefined_object then null; end;
  begin
    alter publication supabase_realtime add table public.message_reactions;
  exception when duplicate_object then null; when undefined_object then null; end;
end $$;
