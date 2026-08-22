import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, env } from '@/lib/env';
import { demoMembers } from '@/lib/demo-data';
import type { Permission, SystemRole } from '@/lib/permissions';
import type { Member } from '@/lib/types';

export const DEMO_COOKIE = 'fh_demo_member';

/** Stable demo family id (matches supabase/seed.sql). */
export const DEMO_FAMILY_ID = '11111111-1111-1111-1111-111111111111';

export interface SessionUser {
  member: Member;
  familyId: string;
  memberId: string;
  isDemo: boolean;
  /** Per-member permission overrides on top of role defaults (see permissions.can). */
  overrides: Partial<Record<Permission, boolean>>;
}

/**
 * Resolve the current signed-in family member.
 *
 * - With Supabase configured: reads the authed user and their family_members row.
 * - In demo mode (no backend): reads a cookie chosen on the demo login screen,
 *   defaulting to Dad, so first-run role routing can be demonstrated.
 *
 * Wrapped in React cache() so the layout and the page share ONE auth check +
 * query per request instead of repeating the ~round-trip several times.
 */
export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    if (!supabase) return null;
    // getSession() reads the JWT from cookies locally (no network round-trip).
    // Middleware already validated/refreshed it via getUser(), and PostgREST
    // re-verifies the token on every query, so this is safe and much faster.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;

    // No profiles join here: it's unused in the shell and an embed error would
    // make the whole query fail (returning null → endless redirect to /welcome).
    const cols = 'id, family_id, display_name, role, is_student, theme, avatar_path';
    let { data, error } = await supabase
      .from('family_members')
      .select(cols)
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    // Insurance: if the `theme`/`avatar_path` columns haven't been migrated yet
    // (42703), retry without them so personalization never bricks sign-in.
    if (error?.code === '42703') {
      ({ data, error } = await supabase
        .from('family_members')
        .select('id, family_id, display_name, role, is_student')
        .eq('profile_id', user.id)
        .eq('status', 'active')
        .maybeSingle());
    }

    if (error) {
      console.error('[getSessionUser] members query error:', error.code, error.message);
    }
    if (!data) return null;

    // Per-member permission overrides (grant/revoke on top of the role).
    const overrides: Partial<Record<Permission, boolean>> = {};
    const { data: perms } = await supabase
      .from('member_permissions')
      .select('permission_key, granted')
      .eq('member_id', data.id);
    for (const p of perms ?? []) overrides[p.permission_key as Permission] = p.granted;

    // Sign the profile picture (private bucket) for this request.
    let avatarUrl: string | null = null;
    const avatarPath = (data as { avatar_path?: string | null }).avatar_path;
    if (avatarPath) {
      const { data: signed } = await supabase.storage
        .from(env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET)
        .createSignedUrl(avatarPath, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    }

    return {
      isDemo: false,
      familyId: data.family_id,
      memberId: data.id,
      overrides,
      member: {
        id: data.id,
        displayName: data.display_name,
        role: data.role as SystemRole,
        isStudent: data.is_student,
        theme: (data as { theme?: string | null }).theme ?? null,
        avatarUrl,
      },
    };
  }

  // Demo mode
  const store = await cookies();
  const id = store.get(DEMO_COOKIE)?.value ?? 'd';
  const member = demoMembers.find((m) => m.id === id) ?? demoMembers[0]!;
  return { isDemo: true, familyId: DEMO_FAMILY_ID, memberId: member.id, member, overrides: {} };
});
