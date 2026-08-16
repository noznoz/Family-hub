'use client';

import { useState } from 'react';
import { Pin, Send, ListPlus, HandCoins, Reply, Smile } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/chip';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';

export function ChatView({
  me,
  pinned,
  messages: initial,
  canSend,
  canConvert,
}: {
  me: string;
  pinned: Message[];
  messages: Message[];
  canSend: boolean;
  canConvert: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [draft, setDraft] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const send = () => {
    if (!draft.trim()) return;
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        sender: me,
        role: 'admin',
        body: draft.trim(),
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setDraft('');
  };

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col md:h-[calc(100dvh-10rem)]">
      <div className="mb-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Family Chat</h1>
      </div>

      {pinned.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Pin className="size-3.5" /> Family Updates
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pinned.map((p) => (
              <Card key={p.id} className="min-w-[220px] shrink-0 border-brand/20 bg-brand-muted/60 p-3">
                <p className="text-sm font-medium text-navy">{p.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.sender} · {p.createdAt}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-white/50 p-3">
        {messages.map((m) => {
          const mine = m.sender === me;
          return (
            <div key={m.id} className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}>
              {!mine && <Avatar name={m.sender} size="sm" />}
              <div className={cn('max-w-[78%]')}>
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2 text-sm',
                    mine ? 'rounded-br-sm bg-navy text-white' : 'rounded-bl-sm bg-white text-navy shadow-card',
                  )}
                >
                  {!mine && <p className="mb-0.5 text-xs font-bold text-brand">{m.sender}</p>}
                  <p>{m.body}</p>
                </div>
                <div className={cn('mt-0.5 flex items-center gap-2 px-1', mine && 'justify-end')}>
                  <span className="text-[10px] text-muted-foreground">{m.createdAt}</span>
                  <button
                    onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                    className="text-muted-foreground hover:text-navy"
                    aria-label="Message actions"
                  >
                    <Smile className="size-3.5" />
                  </button>
                </div>
                {menuFor === m.id && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <MsgAction icon={<Reply className="size-3.5" />} label="Reply" />
                    <MsgAction icon={<span className="text-sm leading-none">👍</span>} label="React" />
                    {canConvert && <MsgAction icon={<ListPlus className="size-3.5" />} label="To Task" tone="brand" />}
                    {canConvert && <MsgAction icon={<HandCoins className="size-3.5" />} label="To Payment" tone="brand" />}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canSend ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Message the family…"
            className="h-12 flex-1 rounded-full border border-input bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button size="icon" variant="brand" onClick={send} aria-label="Send" className="size-12 rounded-full">
            <Send className="size-5" />
          </Button>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-muted p-3 text-center text-sm text-muted-foreground">
          You don&apos;t have permission to send messages in this conversation.
        </p>
      )}
    </div>
  );
}

function MsgAction({ icon, label, tone = 'neutral' }: { icon: React.ReactNode; label: string; tone?: 'neutral' | 'brand' }) {
  return (
    <button type="button">
      <Chip tone={tone} className="cursor-pointer hover:opacity-80">
        {icon} {label}
      </Chip>
    </button>
  );
}
