import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import type { SystemRole } from '@/lib/permissions';
import type { Message } from '@/lib/types';

async function signMedia(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.storage.from(env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

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

export async function getMessages(conversationId: string, meId?: string): Promise<Message[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('messages')
    .select('id, body, pinned, created_at, sender:family_members!messages_sender_id_fkey(display_name, role), attachments:message_attachments(storage_path, mime_type), reactions:message_reactions(emoji, member_id)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);

  return Promise.all(((data ?? []) as unknown as (MsgRow & {
    attachments?: { storage_path: string; mime_type: string | null }[];
    reactions?: { emoji: string; member_id: string }[];
  })[]).map(async (m) => {
    const s = one<{ display_name: string; role: string }>(m.sender);
    const attachments = await Promise.all((m.attachments ?? []).map(async (a) => ({ url: await signMedia(a.storage_path), mime: a.mime_type })));
    // Aggregate reactions by emoji.
    const byEmoji = new Map<string, { count: number; mine: boolean }>();
    for (const r of m.reactions ?? []) {
      const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
      cur.count += 1;
      if (meId && r.member_id === meId) cur.mine = true;
      byEmoji.set(r.emoji, cur);
    }
    return {
      id: m.id,
      sender: s?.display_name ?? 'Unknown',
      role: (s?.role as SystemRole) ?? 'family_member',
      body: m.body ?? '',
      createdAt: timeLabel(m.created_at),
      pinned: m.pinned,
      attachments,
      reactions: [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine })),
    };
  }));
}
