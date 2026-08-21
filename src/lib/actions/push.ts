'use server';

import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import { sendPushToMember } from '@/lib/push';

type Result = { ok: true } | { ok: false; error: string };

export interface WebPushSub { endpoint: string; keys: { p256dh: string; auth: string } }

export async function subscribeToPush(sub: WebPushSub, userAgent?: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Not configured.' };
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      member_id: session.memberId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent ?? null,
    },
    { onConflict: 'endpoint' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unsubscribeFromPush(endpoint: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return { ok: true };
}

export async function sendTestPush(): Promise<Result> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  await sendPushToMember(session.memberId, {
    title: 'Family Hub ✅',
    body: 'Notifications are working. You’ll get alerts here.',
    url: '/notifications',
  });
  return { ok: true };
}
