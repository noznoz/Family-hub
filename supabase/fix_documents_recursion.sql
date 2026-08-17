-- ============================================================================
-- Family Hub — FIX: documents <-> document_shares policy recursion (42P17)
-- Safe, non-destructive. Run once in the Supabase SQL Editor.
-- ============================================================================
create or replace function public.doc_shared_with_me(doc uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.document_shares ds
    join public.family_members fm on fm.id = ds.member_id
    where ds.document_id = doc and fm.profile_id = auth.uid()
  );
$$;

drop policy if exists "doc read" on public.documents;
create policy "doc read" on public.documents for select using (
  public.has_perm(family_id,'manage_documents')
  or (visibility = 'entire_family' and public.has_perm(family_id,'view_documents'))
  or (visibility = 'parents_admins' and public.is_parent_admin(family_id))
  or (visibility = 'private_student' and public.owns_student(student_id))
  or (visibility = 'selected_members' and public.doc_shared_with_me(id))
);

select 'Documents policy recursion fixed — you can use the app fully now.' as result;
