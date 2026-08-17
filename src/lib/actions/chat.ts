'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';

type Result = { ok: true; id?: string } | { ok: false; error: string };

/** Send a message to a conversation as the current family member. */
export async function sendMessage(conversationId: string, body: string): Promise<Result> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Message is empty.' };
  if (!isSupabaseConfigured) return { ok: true };

  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: session.memberId, body: trimmed })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath('/chat');
  return { ok: true, id: data?.id };
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
