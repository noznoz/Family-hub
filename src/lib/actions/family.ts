'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import { can, type SystemRole } from '@/lib/permissions';

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
  if (!can(session.member.role, 'manage_family_members')) {
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
