'use server';

import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import { notifyMembers } from '@/lib/notify';

type Result = { ok: true } | { ok: false; error: string };

/** Send a quick push + in-app notification to the whole family. Parents/admins. */
export async function sendFamilyBroadcast(input: { title?: string; body: string }): Promise<Result> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Type a message.' };
  if (!isSupabaseConfigured) return { ok: true };

  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  if (session.member.role !== 'admin' && session.member.role !== 'parent') {
    return { ok: false, error: 'Only parents and admins can send a family notification.' };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  const { data: members } = await supabase
    .from('family_members')
    .select('id')
    .eq('family_id', session.familyId)
    .neq('status', 'disabled');
  const recipients = (members ?? [])
    .map((m) => m.id as string)
    .filter((id) => id !== session.memberId);
  if (recipients.length === 0) return { ok: false, error: 'No one else to notify.' };

  await notifyMembers({
    familyId: session.familyId,
    memberIds: recipients,
    title: input.title?.trim() || `📣 ${session.member.displayName}`,
    body,
    url: '/home',
    kind: 'family_update',
    push: true,
    email: false,
    requireInteraction: true,
  });
  return { ok: true };
}
