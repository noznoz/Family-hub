'use server';

import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { THEME_COOKIE, isThemeId, type ThemeId } from '@/lib/theme';

/**
 * Persist the current member's chosen appearance to their account so it follows
 * them across devices. Also mirrors the choice into the cookie (fast path for
 * the next server render, and the sole store in demo mode).
 *
 * Uses the service-role client, scoped to the caller's own member id resolved
 * from their session — a member can only ever change their own row.
 */
export async function saveTheme(theme: ThemeId): Promise<{ ok: boolean }> {
  if (!isThemeId(theme)) return { ok: false };

  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  const session = await getSessionUser();
  // Demo mode (or signed out): cookie is the only store.
  if (!session || session.isDemo) return { ok: true };

  const admin = createAdminClient();
  if (!admin) return { ok: true };

  const { error } = await admin
    .from('family_members')
    .update({ theme })
    .eq('id', session.memberId);

  if (error && error.code !== '42703') {
    console.error('[saveTheme] update failed:', error.code, error.message);
    return { ok: false };
  }
  return { ok: true };
}
