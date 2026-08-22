'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import { can, PERMISSIONS, ROLE_DEFAULTS, type Permission, type SystemRole } from '@/lib/permissions';

type Result = { ok: true } | { ok: false; error: string };

export interface AddMemberInput {
  displayName: string;
  role: SystemRole;
  relationship?: string;
  inviteEmail?: string;
  isStudent?: boolean;
}

async function requireManage(): Promise<
  { ok: true; familyId: string; actorId: string | null } | { ok: false; error: string }
> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  if (!can(session.member.role, 'manage_family_members', session.overrides)) {
    return { ok: false, error: 'You do not have permission to manage family members.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  return { ok: true, familyId: session.familyId, actorId: user?.id ?? null };
}

/** Audit helper for sensitive family/permission changes. */
async function audit(familyId: string, actorId: string | null, action: string, entityId: string, meta: object) {
  const supabase = await createClient();
  await supabase?.from('audit_logs').insert({
    family_id: familyId,
    actor_id: actorId,
    action,
    entity: 'family_member',
    entity_id: entityId,
    meta,
  });
}

export async function addFamilyMember(input: AddMemberInput): Promise<Result> {
  if (!input.displayName.trim()) return { ok: false, error: 'Name is required.' };
  if (!isSupabaseConfigured) return { ok: true };

  const guard = await requireManage();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  const { data, error } = await supabase
    .from('family_members')
    .insert({
      family_id: guard.familyId,
      display_name: input.displayName.trim(),
      role: input.role,
      is_student: input.isStudent ?? input.role === 'student',
      status: input.inviteEmail ? 'invited' : 'active',
      invite_email: input.inviteEmail?.trim() || null,
      created_by: guard.actorId,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  if (input.relationship && data) {
    await supabase.from('family_relationships').insert({
      family_id: guard.familyId,
      member_id: data.id,
      relationship: input.relationship,
    });
  }
  await audit(guard.familyId, guard.actorId, 'member.add', data?.id ?? '', { role: input.role });

  revalidatePath('/family');
  return { ok: true };
}

export async function updateMemberRole(memberId: string, role: SystemRole): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const guard = await requireManage();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  const { error } = await supabase.from('family_members').update({ role }).eq('id', memberId);
  if (error) return { ok: false, error: error.message };
  await audit(guard.familyId, guard.actorId, 'member.role_change', memberId, { role });

  revalidatePath('/family');
  return { ok: true };
}

export async function setMemberStatus(memberId: string, status: 'active' | 'disabled'): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const guard = await requireManage();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  const { error } = await supabase.from('family_members').update({ status }).eq('id', memberId);
  if (error) return { ok: false, error: error.message };
  await audit(guard.familyId, guard.actorId, 'member.status_change', memberId, { status });

  revalidatePath('/family');
  return { ok: true };
}

/**
 * Permanently remove a family member. Dependent rows cascade (relationships,
 * permissions, chat memberships, reactions, receipts, push subs) or null out
 * (task assignee, message sender, payment parties) per the schema's FKs, so
 * authored content is preserved while the person is removed. Guards against
 * self-deletion and removing the family's last admin (lockout).
 */
export async function deleteFamilyMember(memberId: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  if (!can(session.member.role, 'manage_family_members', session.overrides)) {
    return { ok: false, error: 'You do not have permission to manage family members.' };
  }
  if (memberId === session.memberId) {
    return { ok: false, error: 'You can’t delete your own account here.' };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  // Prevent removing the last admin and leaving the family locked out.
  const { data: target } = await supabase
    .from('family_members')
    .select('role, family_id')
    .eq('id', memberId)
    .single();
  if (!target) return { ok: false, error: 'That member no longer exists.' };
  if (target.family_id !== session.familyId) {
    return { ok: false, error: 'That member is not in your family.' };
  }
  if (target.role === 'admin') {
    const { count } = await supabase
      .from('family_members')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', session.familyId)
      .eq('role', 'admin');
    if ((count ?? 0) <= 1) {
      return { ok: false, error: 'You can’t delete the last admin. Make someone else an admin first.' };
    }
  }

  const {
    data: { user },
  } = (await supabase.auth.getUser()) ?? { data: { user: null } };
  const { error } = await supabase.from('family_members').delete().eq('id', memberId);
  if (error) return { ok: false, error: error.message };
  await audit(session.familyId, user?.id ?? null, 'member.delete', memberId, { role: target.role });

  revalidatePath('/family');
  return { ok: true };
}

export interface MemberPermissionRow { key: Permission; label: string; roleDefault: boolean; effective: boolean; override: boolean | null }

/** Load a member's permissions: role default, current override, effective value. */
export async function getMemberPermissions(memberId: string, role: SystemRole): Promise<MemberPermissionRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from('member_permissions').select('permission_key, granted').eq('member_id', memberId);
  const overrides = new Map<string, boolean>();
  for (const p of data ?? []) overrides.set(p.permission_key, p.granted);
  return PERMISSIONS.map((key) => {
    const roleDefault = role === 'admin' ? true : ROLE_DEFAULTS[role].includes(key);
    const override = overrides.has(key) ? overrides.get(key)! : null;
    return { key, label: key, roleDefault, override, effective: override ?? roleDefault };
  });
}

/** Set or clear (granted=null) a per-member permission override. */
export async function setMemberPermission(memberId: string, key: Permission, granted: boolean | null): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const guard = await requireManage();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  if (granted === null) {
    const { error } = await supabase.from('member_permissions').delete().eq('member_id', memberId).eq('permission_key', key);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('member_permissions')
      .upsert({ member_id: memberId, permission_key: key, granted, created_by: guard.actorId }, { onConflict: 'member_id,permission_key' });
    if (error) return { ok: false, error: error.message };
  }
  await audit(guard.familyId, guard.actorId, 'member.permission_change', memberId, { key, granted });
  revalidatePath('/family');
  return { ok: true };
}

/** Set a member's relationship label (e.g. son, dad). */
export async function setMemberRelationship(memberId: string, relationship: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const guard = await requireManage();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  const rel = relationship.trim().toLowerCase().replace(/\s+/g, '_');
  await supabase.from('family_relationships').delete().eq('member_id', memberId);
  if (rel) {
    const { error } = await supabase.from('family_relationships').insert({ family_id: guard.familyId, member_id: memberId, relationship: rel });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath('/family');
  return { ok: true };
}

export async function setMemberEmail(memberId: string, email: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const guard = await requireManage();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  const clean = email.trim().toLowerCase();
  if (clean && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: 'Enter a valid email.' };
  const { error } = await supabase.from('family_members').update({ invite_email: clean || null }).eq('id', memberId);
  if (error) return { ok: false, error: error.message };
  await audit(guard.familyId, guard.actorId, 'member.set_email', memberId, {});
  revalidatePath('/family');
  return { ok: true };
}
