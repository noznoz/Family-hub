import 'server-only';
import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

let configured = false;

async function ensureVapid(): Promise<{ publicKey: string } | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from('app_config').select('key, value').in('key', ['vapid_public', 'vapid_private']);
  const pub = data?.find((r) => r.key === 'vapid_public')?.value;
  const priv = data?.find((r) => r.key === 'vapid_private')?.value;
  if (!pub || !priv) return null;
  if (!configured) {
    webpush.setVapidDetails('mailto:family-hub@example.com', pub, priv);
    configured = true;
  }
  return { publicKey: pub };
}

export async function getVapidPublicKey(): Promise<string | null> {
  const v = await ensureVapid();
  return v?.publicKey ?? null;
}

export interface PushPayload { title: string; body: string; url?: string }

/** Send a push to every device a member has subscribed. Prunes dead subs. */
export async function sendPushToMember(memberId: string, payload: PushPayload): Promise<void> {
  const v = await ensureVapid();
  if (!v) return;
  const admin = createAdminClient();
  if (!admin) return;
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('member_id', memberId);
  if (!subs?.length) return;

  const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? '/home' });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      );
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await admin.from('push_subscriptions').delete().eq('id', s.id);
      }
    }
  }));
}
