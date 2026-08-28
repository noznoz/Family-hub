'use server';

import webpush from 'web-push';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

type Result = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: 'Not signed in.' };
  if (session.member.role !== 'admin') return { ok: false as const, error: 'Only an admin can set up push notifications.' };
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, error: 'Backend unavailable.' };
  return { ok: true as const, session, admin };
}

export interface PushStatus { configured: boolean; tableMissing: boolean }

export async function getPushStatus(): Promise<PushStatus> {
  const g = await requireAdmin();
  if (!g.ok) return { configured: false, tableMissing: false };
  const { data, error } = await g.admin.from('app_config').select('key').in('key', ['vapid_public', 'vapid_private']);
  if (error) return { configured: false, tableMissing: error.code === '42P01' };
  return { configured: (data?.length ?? 0) >= 2, tableMissing: false };
}

/**
 * Generate a VAPID key pair and save it to app_config. Only overwrites when
 * `force` is set — regenerating invalidates every existing subscription, so
 * everyone would have to re-enable notifications.
 */
export async function generateVapidKeys(force = false): Promise<Result> {
  const g = await requireAdmin();
  if (!g.ok) return g;

  if (!force) {
    const { data } = await g.admin.from('app_config').select('key').in('key', ['vapid_public', 'vapid_private']);
    if ((data?.length ?? 0) >= 2) return { ok: false, error: 'Push keys already exist.' };
  }

  const keys = webpush.generateVAPIDKeys();
  const now = new Date().toISOString();
  const { error } = await g.admin.from('app_config').upsert([
    { key: 'vapid_public', value: keys.publicKey, updated_at: now },
    { key: 'vapid_private', value: keys.privateKey, updated_at: now },
  ], { onConflict: 'key' });
  if (error) {
    if (error.code === '42P01') return { ok: false, error: 'Config table not ready yet — try again in a minute.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/settings');
  return { ok: true };
}
