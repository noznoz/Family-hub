import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { demoMessages, demoPinned } from '@/lib/demo-data';
import { ChatView } from '@/components/chat/chat-view';
import { can } from '@/lib/permissions';

export const metadata: Metadata = { title: 'Chat' };

export default async function ChatPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const canSend = can(session.member.role, 'send_family_messages');
  const canConvert = can(session.member.role, 'approve_payment_requests');

  return (
    <ChatView
      me={session.member.displayName}
      pinned={demoPinned}
      messages={demoMessages}
      canSend={canSend}
      canConvert={canConvert}
    />
  );
}
