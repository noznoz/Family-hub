import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SystemRole } from '@/lib/permissions';
import type { Message } from '@/lib/types';

export interface Conversation {
  id: string;
  title: string;
  kind: string;
}

function one<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Conversations the current user can see (RLS: membership only). */
export async function getConversations(familyId: string): Promise<Conversation[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('conversations')
    .select('id, title, kind')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((c) => ({ id: c.id, title: c.title, kind: c.kind }));
}

interface MsgRow {
  id: string;
  body: string | null;
  pinned: boolean;
  created_at: string;
  sender: { display_name: string; role: string } | null;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('messages')
    .select('id, body, pinned, created_at, sender:family_members!messages_sender_id_fkey(display_name, role)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);

  return ((data ?? []) as unknown as MsgRow[]).map((m) => {
    const s = one<{ display_name: string; role: string }>(m.sender);
    return {
      id: m.id,
      sender: s?.display_name ?? 'Unknown',
      role: (s?.role as SystemRole) ?? 'family_member',
      body: m.body ?? '',
      createdAt: timeLabel(m.created_at),
      pinned: m.pinned,
    };
  });
}
