import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface UnreadCounts { chat: number; notifications: number; total: number }

/** Unread chat messages + unread notifications for a member. */
export async function getUnreadCounts(memberId: string): Promise<UnreadCounts> {
  const supabase = await createClient();
  if (!supabase) return { chat: 0, notifications: 0, total: 0 };

  try {
    // Chat: count per conversation with a head-only query, so we transfer counts
    // rather than message rows (this runs on every page load) and stay exact.
    const { data: cms } = await supabase
      .from('conversation_members').select('conversation_id, last_read_at').eq('member_id', memberId);

    const [perConversation, notifRes] = await Promise.all([
      Promise.all((cms ?? []).map(async (c) => {
        let q = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', c.conversation_id)
          .neq('sender_id', memberId);
        if (c.last_read_at) q = q.gt('created_at', c.last_read_at);
        const { count } = await q;
        return count ?? 0;
      })),
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('recipient_id', memberId).is('read_at', null),
    ]);

    const chat = perConversation.reduce((sum, n) => sum + n, 0);
    const notifications = notifRes.count ?? 0;
    return { chat, notifications, total: chat + notifications };
  } catch (e) {
    // Badges are decoration — never let them break the app shell.
    console.error('[getUnreadCounts]', e instanceof Error ? e.message : String(e));
    return { chat: 0, notifications: 0, total: 0 };
  }
}
