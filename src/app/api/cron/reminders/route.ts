import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyMembers } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dispatch due reminders. Called every minute by the pg_cron job in Supabase
 * (see supabase/migrate_reminders.sql), authenticated with the shared secret
 * stored in app_config. Sends push + in-app + email for each due reminder,
 * then marks it sent.
 */
export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const { data: secretRow } = await admin.from('app_config').select('value').eq('key', 'cron_secret').maybeSingle();
  const secret = secretRow?.value;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data: due } = await admin
    .from('reminders')
    .select('id, family_id, title, body, link, recipient_ids, channel_push, channel_email')
    .eq('status', 'pending')
    .lte('remind_at', nowIso)
    .limit(100);

  let sent = 0;
  for (const r of due ?? []) {
    try {
      await notifyMembers({
        familyId: r.family_id,
        memberIds: (r.recipient_ids as string[]) ?? [],
        title: r.title,
        body: r.body ?? undefined,
        url: r.link ?? '/home',
        kind: 'system',
        push: r.channel_push !== false,
        email: r.channel_email !== false,
        requireInteraction: true,
      });
      await admin.from('reminders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', r.id);
      sent += 1;
    } catch (e) {
      console.error('[cron/reminders] failed for', r.id, e instanceof Error ? e.message : String(e));
      await admin.from('reminders').update({ status: 'error' }).eq('id', r.id);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
