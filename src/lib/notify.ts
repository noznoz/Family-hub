import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToMember } from '@/lib/push';
import { sendEmail, emailShell } from '@/lib/email';
import { env } from '@/lib/env';

/** Valid values of the notification_kind enum used for the in-app feed. */
export type NotifyKind =
  | 'task_due' | 'payment_due' | 'payment_request' | 'payment_approved'
  | 'document_expiring' | 'trip_approaching' | 'scholarship_deadline'
  | 'new_message' | 'family_update' | 'system';

export interface NotifyInput {
  familyId: string;
  memberIds: string[];
  title: string;
  body?: string;
  url?: string;
  kind?: NotifyKind;
  push?: boolean;
  email?: boolean;
  /** Keep the phone notification on screen until tapped (used for reminders). */
  requireInteraction?: boolean;
}

function baseUrl(): string {
  return env.NEXT_PUBLIC_PRODUCTION_DOMAIN || env.NEXT_PUBLIC_APP_URL || '';
}

/**
 * Fan a notification out to one or more members across every channel:
 *  1. an in-app notification row (the bell feed),
 *  2. a phone push (default tone), and
 *  3. an email (only if an email key is configured — otherwise skipped).
 * Best-effort: a failure on one channel never blocks the others.
 */
export async function notifyMembers(input: NotifyInput): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const members = [...new Set(input.memberIds)].filter(Boolean);
  if (members.length === 0) return;

  const kind: NotifyKind = input.kind ?? 'system';
  const url = input.url ?? '/home';

  // 1) In-app feed
  try {
    await admin.from('notifications').insert(
      members.map((id) => ({
        family_id: input.familyId,
        recipient_id: id,
        kind,
        title: input.title,
        body: input.body ?? null,
        link: url,
      })),
    );
  } catch (e) {
    console.error('[notifyMembers] in-app insert failed:', e instanceof Error ? e.message : String(e));
  }

  // 2) Push
  if (input.push !== false) {
    await Promise.all(
      members.map((id) => sendPushToMember(id, {
        title: input.title, body: input.body ?? '', url,
        requireInteraction: input.requireInteraction,
      }).catch(() => {})),
    );
  }

  // 3) Email
  if (input.email !== false) {
    try {
      const emails = await resolveEmails(admin, members);
      if (emails.length) {
        const abs = url.startsWith('http') ? url : `${baseUrl()}${url}`;
        await sendEmail({
          to: emails,
          subject: input.title,
          html: emailShell(input.title, (input.body ?? '').replace(/\n/g, '<br>'), 'Open Family Hub', abs || undefined),
          text: `${input.title}\n\n${input.body ?? ''}\n\n${abs}`,
        });
      }
    } catch (e) {
      console.error('[notifyMembers] email failed:', e instanceof Error ? e.message : String(e));
    }
  }
}

/** Resolve login emails for a set of members (linked profile first, else the invite email). */
async function resolveEmails(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  memberIds: string[],
): Promise<string[]> {
  const { data: members } = await admin
    .from('family_members')
    .select('id, profile_id, invite_email')
    .in('id', memberIds);
  if (!members?.length) return [];

  const profileIds = members.map((m) => m.profile_id).filter((v): v is string => !!v);
  const emailByProfile = new Map<string, string>();
  if (profileIds.length) {
    const { data: profiles } = await admin.from('profiles').select('id, email').in('id', profileIds);
    for (const p of profiles ?? []) if (p.email) emailByProfile.set(p.id, p.email);
  }

  const out = new Set<string>();
  for (const m of members) {
    const email = (m.profile_id && emailByProfile.get(m.profile_id)) || m.invite_email;
    if (email) out.add(email);
  }
  return [...out];
}
