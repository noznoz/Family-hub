'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';

type Result = { ok: true; id?: string } | { ok: false; error: string };

export interface ReminderInput {
  entityType?: string;
  entityId?: string | null;
  title: string;
  body?: string;
  link?: string;
  remindAt: string;            // datetime-local value (local time)
  recipientIds?: string[];     // family_member ids; defaults to the creator
  channelEmail?: boolean;
}

/**
 * Record the app's public URL in app_config the first time we can see it, so
 * the pg_cron dispatcher knows where to call. Cheap and idempotent.
 */
async function ensureAppUrl() {
  const admin = createAdminClient();
  if (!admin) return;
  const { data } = await admin.from('app_config').select('value').eq('key', 'app_url').maybeSingle();
  if (data?.value) return;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  if (host) {
    await admin.from('app_config').upsert({ key: 'app_url', value: `${proto}://${host}` }, { onConflict: 'key' });
  }
}

export async function createReminder(input: ReminderInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!input.remindAt) return { ok: false, error: 'Pick a date and time.' };
  const when = new Date(input.remindAt);
  if (Number.isNaN(when.getTime())) return { ok: false, error: 'Invalid date.' };
  if (when.getTime() < Date.now() - 60_000) return { ok: false, error: 'Pick a time in the future.' };
  if (!isSupabaseConfigured) return { ok: true };

  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  const recipients = input.recipientIds?.length ? input.recipientIds : [session.memberId];

  const { data, error } = await supabase.from('reminders').insert({
    family_id: session.familyId,
    created_by: session.memberId,
    entity_type: input.entityType ?? 'custom',
    entity_id: input.entityId ?? null,
    title: input.title.trim(),
    body: input.body || null,
    link: input.link || '/home',
    remind_at: when.toISOString(),
    recipient_ids: recipients,
    channel_push: true,
    channel_email: input.channelEmail !== false,
    status: 'pending',
  }).select('id').single();
  if (error) return { ok: false, error: error.message };

  await ensureAppUrl();
  revalidatePath('/notifications');
  return { ok: true, id: data?.id };
}

export async function cancelReminder(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  const { error } = await supabase.from('reminders').update({ status: 'cancelled' }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/notifications');
  return { ok: true };
}
