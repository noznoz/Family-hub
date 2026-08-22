'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pin, Send, ListPlus, HandCoins, Smile, ImagePlus, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/chip';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { uploadMedia } from '@/lib/storage';
import { sendMessage, toggleReaction, convertMessageToTask, convertMessageToPayment, createConversation, markConversationRead } from '@/lib/actions/chat';
import type { Message } from '@/lib/types';
import type { Conversation } from '@/lib/chat-queries';

const QUICK = ['👍', '❤️', '😂', '🎉', '🙏', '✅'];

export function ChatView({
  live, me, familyId, conversationId, conversations, pinned, messages: initial, canSend, canConvert,
}: {
  live: boolean;
  me: string;
  familyId: string;
  conversationId: string;
  conversations: Conversation[];
  pinned: Message[];
  messages: Message[];
  canSend: boolean;
  canConvert: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initial);
  const [draft, setDraft] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const title = conversations.find((c) => c.id === conversationId)?.title ?? 'Family Chat';

  useEffect(() => setMessages(initial), [initial]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // Mark this conversation read on open / when new messages arrive while viewing.
  useEffect(() => {
    if (!live) return;
    void markConversationRead(conversationId).then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, conversationId, initial.length]);

  useEffect(() => {
    if (!live) return;
    const supabase = createClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [live, conversationId, router]);

  const send = async () => {
    const body = draft.trim();
    if (!body && !file) return;
    setDraft('');
    if (!live) {
      setMessages((m) => [...m, { id: `tmp-${Date.now()}`, sender: me, role: 'admin', body, createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      setFile(null);
      return;
    }
    setSending(true);
    try {
      const attachments = [] as { path: string; mime?: string; name?: string; size?: number }[];
      if (file) {
        const safe = file.name.replace(/[^\w.\-]+/g, '_');
        const path = await uploadMedia(familyId, file, `chat/${conversationId}/${Date.now()}-${safe}`);
        if (path) attachments.push({ path, mime: file.type, name: file.name, size: file.size });
      }
      await sendMessage(conversationId, body, attachments);
      setFile(null);
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  const react = (id: string, emoji: string) => {
    setMenuFor(null);
    if (live) startTransition(async () => { await toggleReaction(id, emoji); router.refresh(); });
  };
  const toTask = (id: string) => {
    setMenuFor(null);
    if (live) startTransition(async () => { await convertMessageToTask(id); router.refresh(); });
  };
  const toPayment = (id: string) => {
    setMenuFor(null);
    const val = window.prompt('Amount to request (£):');
    const amount = Number(val);
    if (!amount || amount <= 0) return;
    if (live) startTransition(async () => { await convertMessageToPayment(id, amount); router.refresh(); });
  };

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col md:h-[calc(100dvh-10rem)]">
      <div className="mb-3"><h1 className="text-2xl font-extrabold tracking-tight text-navy">{title}</h1></div>

      {/* Channels */}
      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
        {conversations.map((c) => (
          <Link key={c.id} href={`/chat?c=${c.id}`}
            className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
              c.id === conversationId ? 'bg-navy text-white' : 'bg-muted text-muted-foreground hover:bg-accent')}>
            {c.title}
          </Link>
        ))}
        {canSend && <NewChannelButton live={live} />}
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
              <div className="max-w-[78%]">
                <div className={cn('rounded-2xl px-3.5 py-2 text-sm', mine ? 'rounded-br-sm bg-navy text-white' : 'rounded-bl-sm bg-white text-navy shadow-card')}>
                  {!mine && <p className="mb-0.5 text-xs font-bold text-brand">{m.sender}</p>}
                  {m.attachments?.filter((a) => a.url).map((a, i) => (
                    a.mime?.startsWith('image/')
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img key={i} src={a.url!} alt="attachment" className="mb-1.5 max-h-60 rounded-xl object-cover" />
                      : <a key={i} href={a.url!} target="_blank" rel="noopener noreferrer" className={cn('mb-1 block underline', mine ? 'text-white' : 'text-brand')}>Attachment</a>
                  ))}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                </div>

                {/* Reactions */}
                {(m.reactions?.length ?? 0) > 0 && (
                  <div className={cn('mt-1 flex flex-wrap gap-1', mine && 'justify-end')}>
                    {m.reactions!.map((r) => (
                      <button key={r.emoji} onClick={() => react(m.id, r.emoji)}
                        className={cn('rounded-full border px-2 py-0.5 text-xs', r.mine ? 'border-brand bg-brand-muted' : 'border-border bg-white')}>
                        {r.emoji} {r.count}
                      </button>
                    ))}
                  </div>
                )}

                <div className={cn('mt-0.5 flex items-center gap-2 px-1', mine && 'justify-end')}>
                  <span className="text-[10px] text-muted-foreground">{m.createdAt}</span>
                  {live && (
                    <button onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} className="text-muted-foreground hover:text-navy" aria-label="Message actions">
                      <Smile className="size-3.5" />
                    </button>
                  )}
                </div>

                {menuFor === m.id && (
                  <div className={cn('mt-1 flex flex-wrap items-center gap-1.5', mine && 'justify-end')}>
                    {QUICK.map((e) => (
                      <button key={e} onClick={() => react(m.id, e)} className="rounded-full border border-border bg-white px-2 py-1 text-sm hover:bg-muted">{e}</button>
                    ))}
                    {canConvert && (
                      <>
                        <button onClick={() => toTask(m.id)}><Chip tone="brand"><ListPlus className="size-3.5" /> Task</Chip></button>
                        <button onClick={() => toPayment(m.id)}><Chip tone="brand"><HandCoins className="size-3.5" /> Payment</Chip></button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <div className="mt-3">
          {file && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-navy">
              <ImagePlus className="size-4 text-navy-400" />
              <span className="flex-1 truncate">{file.name}</span>
              <button onClick={() => setFile(null)} className="text-danger">Remove</button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach photo"
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-input bg-white text-navy-400 hover:text-navy">
              <ImagePlus className="size-5" />
            </button>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Message the family…"
              className="h-12 flex-1 rounded-full border border-input bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <Button size="icon" variant="brand" onClick={send} disabled={sending} aria-label="Send" className="size-12 rounded-full">
              {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-muted p-3 text-center text-sm text-muted-foreground">
          You don&apos;t have permission to send messages here.
        </p>
      )}
    </div>
  );
}

function NewChannelButton({ live }: { live: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (fd: FormData) => {
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return setError('Name is required.');
    setError(null);
    startTransition(async () => {
      const res = live ? await createConversation(title) : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false);
      if (live && 'id' in res && res.id) router.push(`/chat?c=${res.id}`);
      else router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label="New channel" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-navy-400 hover:bg-muted hover:text-navy">
          <Plus className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent title="New channel">
        <form action={onSubmit} className="space-y-3">
          <Input name="title" required autoFocus placeholder="e.g. Term 1, Trips, Hamza" />
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Creating…' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
