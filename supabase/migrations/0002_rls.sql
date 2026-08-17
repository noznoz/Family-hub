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
create policy "doc read" on public.documents for select using (
  public.has_perm(family_id,'manage_documents')
  or (visibility = 'entire_family' and public.has_perm(family_id,'view_documents'))
  or (visibility = 'parents_admins' and public.is_parent_admin(family_id))
  or (visibility = 'private_student' and public.owns_student(student_id))
  or (visibility = 'selected_members' and exists (
        select 1 from public.document_shares ds
        join public.family_members fm on fm.id = ds.member_id
        where ds.document_id = public.documents.id and fm.profile_id = auth.uid()))
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
