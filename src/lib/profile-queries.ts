import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

function one<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

export interface MyProfile {
  memberId: string;
  displayName: string;
  role: string;
  isStudent: boolean;
  relationship: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  familyName: string | null;
  memberSince: string | null;
  student: { university: string; course: string } | null;
}

/** Full profile of the signed-in member: personal info + family + student card. */
export async function getMyProfile(memberId: string): Promise<MyProfile | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();

  const { data: member } = await supabase
    .from('family_members')
    .select('id, display_name, role, is_student, invite_email, avatar_path, created_at, family:families(name), relationships:family_relationships!family_relationships_member_id_fkey(relationship)')
    .eq('id', memberId)
    .maybeSingle();
  if (!member) return null;

  let avatarUrl: string | null = null;
  const avatarPath = (member as { avatar_path?: string | null }).avatar_path;
  if (avatarPath) {
    const { data: signed } = await supabase.storage
      .from(env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET)
      .createSignedUrl(avatarPath, 3600);
    avatarUrl = signed?.signedUrl ?? null;
  }

  let email: string | null = user?.email ?? (member as { invite_email?: string | null }).invite_email ?? null;
  let phone: string | null = null;
  if (user?.id) {
    const { data: profile } = await supabase.from('profiles').select('email, phone').eq('id', user.id).maybeSingle();
    if (profile?.email) email = profile.email;
    phone = profile?.phone ?? null;
  }

  let student: { university: string; course: string } | null = null;
  if (member.is_student) {
    const { data: sp } = await supabase
      .from('student_profiles')
      .select('course, university:universities(name)')
      .eq('member_id', memberId)
      .maybeSingle();
    if (sp) student = { university: one<{ name: string }>(sp.university)?.name ?? '—', course: sp.course ?? '—' };
  }

  return {
    memberId: member.id,
    displayName: member.display_name,
    role: member.role,
    isStudent: member.is_student,
    relationship:
      (member.relationships as { relationship: string }[] | null)?.[0]?.relationship?.replace(/_/g, ' ') ?? null,
    email,
    phone,
    avatarUrl,
    familyName: one<{ name: string }>(member.family)?.name ?? null,
    memberSince: member.created_at
      ? new Date(member.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : null,
    student,
  };
}
