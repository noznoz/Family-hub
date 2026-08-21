'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';

type Result = { ok: true; id?: string } | { ok: false; error: string };

export interface ChatAttachment { path: string; mime?: string; name?: string; size?: number }

/** Send a message (optionally with attachments) as the current family member. */
export async function sendMessage(conversationId: string, body: string, attachments: ChatAttachment[] = []): Promise<Result> {
  const trimmed = body.trim();
  if (!trimmed && attachments.length === 0) return { ok: false, error: 'Message is empty.' };
  if (!isSupabaseConfigured) return { ok: true };

  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: session.memberId, body: trimmed || null })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to send.' };

  if (attachments.length) {
    await supabase.from('message_attachments').insert(attachments.map((a) => ({
      message_id: data.id, storage_path: a.path, mime_type: a.mime ?? null, file_name: a.name ?? null, size_bytes: a.size ?? null,
    })));
  }

  revalidatePath('/chat');
  return { ok: true, id: data.id };
}

/** Toggle an emoji reaction on a message for the current member. */
export async function toggleReaction(messageId: string, emoji: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  const { data: existing } = await supabase
    .from('message_reactions').select('id').eq('message_id', messageId).eq('member_id', session.memberId).eq('emoji', emoji).maybeSingle();
  if (existing) {
    await supabase.from('message_reactions').delete().eq('id', existing.id);
  } else {
    await supabase.from('message_reactions').insert({ message_id: messageId, member_id: session.memberId, emoji });
  }
  revalidatePath('/chat');
  return { ok: true };
}

/** Turn a chat message into a family task, linked back to the message. */
export async function convertMessageToTask(messageId: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  const { data: msg } = await supabase.from('messages').select('body').eq('id', messageId).maybeSingle();
  const title = (msg?.body ?? '').trim();
  if (!title) return { ok: false, error: 'Message has no text to make a task from.' };
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('tasks').insert({
    family_id: session.familyId, title: title.slice(0, 200), priority: 'normal', status: 'todo',
    source_message_id: messageId, created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/tasks');
  return { ok: true };
}

/** Turn a chat message into a payment request. */
export async function convertMessageToPayment(messageId: string, amount: number): Promise<Result> {
  if (!amount || amount <= 0) return { ok: false, error: 'Enter a valid amount.' };
  if (!isSupabaseConfigured) return { ok: true };
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  const { data: msg } = await supabase.from('messages').select('body').eq('id', messageId).maybeSingle();
  const reason = (msg?.body ?? '').trim() || 'Payment request';
  const { error } = await supabase.from('payment_requests').insert({
    family_id: session.familyId, amount, currency: 'GBP', reason: reason.slice(0, 200),
    category: 'other', urgency: 'normal', requested_by: session.memberId, status: 'requested',
    source_message_id: messageId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/money');
  return { ok: true };
}

/** Pin/unpin a message (surfaces it in Family Updates). */
export async function setPinned(messageId: string, pinned: boolean): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  const { error } = await supabase.from('messages').update({ pinned }).eq('id', messageId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/chat');
  return { ok: true };
}
