import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getConversations, getMessages } from '@/lib/chat-queries';
import { demoMessages, demoPinned } from '@/lib/demo-data';
import { ChatView } from '@/components/chat/chat-view';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Chat' };

export default async function ChatPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const canSend = can(session.member.role, 'send_family_messages');
  const canConvert = can(session.member.role, 'approve_payment_requests');

  if (session.isDemo) {
    return (
      <ChatView
        live={false}
        me={session.member.displayName}
        familyId={session.familyId}
        conversationId="demo"
        conversations={[{ id: 'demo', title: 'Family Chat', kind: 'family' }]}
        pinned={demoPinned}
        messages={demoMessages}
        canSend={canSend}
        canConvert={canConvert}
      />
    );
  }

  const conversations = await getConversations(session.familyId);
  if (conversations.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Chat</h1>
        <EmptyState title="No conversations yet" hint="A family conversation will appear here." />
      </div>
    );
  }
  const active = conversations[0]!;
  const messages = await getMessages(active.id, session.memberId);

  return (
    <ChatView
      live
      me={session.member.displayName}
      familyId={session.familyId}
      conversationId={active.id}
      conversations={conversations}
      pinned={messages.filter((m) => m.pinned)}
      messages={messages}
      canSend={canSend}
      canConvert={canConvert}
    />
  );
}
