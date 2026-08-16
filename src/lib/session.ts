import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { demoMembers } from '@/lib/demo-data';
import type { SystemRole } from '@/lib/permissions';
import type { Member } from '@/lib/types';

export const DEMO_COOKIE = 'fh_demo_member';

export interface SessionUser {
  member: Member;
  isDemo: boolean;
}

/**
 * Resolve the current signed-in family member.
 *
 * - With Supabase configured: reads the authed user and their family_members row.
 * - In demo mode (no backend): reads a cookie chosen on the demo login screen,
 *   defaulting to Dad, so first-run role routing can be demonstrated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('family_members')
      .select('id, display_name, role, is_student, profile:profiles(avatar_url)')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!data) return null;
    return {
      isDemo: false,
      member: {
        id: data.id,
        displayName: data.display_name,
        role: data.role as SystemRole,
        isStudent: data.is_student,
        avatarUrl: (data.profile as { avatar_url?: string } | null)?.avatar_url ?? null,
      },
    };
  }

  // Demo mode
  const store = await cookies();
  const id = store.get(DEMO_COOKIE)?.value ?? 'd';
  const member = demoMembers.find((m) => m.id === id) ?? demoMembers[0]!;
  return { isDemo: true, member };
}
