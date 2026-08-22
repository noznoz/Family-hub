import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface UnreadCounts { chat: number; notifications: number; total: number }

/** Unread chat messages + unread notifications for a member. */
export async function getUnreadCounts(memberId: string): Promise<UnreadCounts> {
  const supabase = await createClient();
  if (!supabase) return { chat: 0, notifications: 0, total: 0 };

  // Chat: messages in the member's conversations, after their last read, not their own.
  let chat = 0;
  const { data: cms } = await supabase
    .from('conversation_members').select('conversation_id, last_read_at').eq('member_id', memberId);
  const convIds = (cms ?? []).map((c) => c.conversation_id);
  if (convIds.length) {
    const lastRead = new Map<string, string | null>();
    for (const c of cms ?? []) lastRead.set(c.conversation_id, c.last_read_at);
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, created_at')
      .in('conversation_id', convIds)
      .neq('sender_id', memberId)
      .order('created_at', { ascending: false })
      .limit(500);
    for (const m of msgs ?? []) {
      const lr = lastRead.get(m.conversation_id);
      if (!lr || m.created_at > lr) chat += 1;
    }
  }

  const { count } = await supabase
    .from('notifications').select('id', { count: 'exact', head: true })
    .eq('recipient_id', memberId).is('read_at', null);
  const notifications = count ?? 0;

  return { chat, notifications, total: chat + notifications };
}
