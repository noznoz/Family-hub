'use client';

import { useState, useTransition } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { listTaskComments, addTaskComment, type TaskComment } from '@/lib/actions/tasks';

export function TaskCommentsDialog({ taskId, title, live }: { taskId: string; title: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [, startTransition] = useTransition();

  const load = async () => {
    if (!live) return;
    setLoading(true);
    setComments(await listTaskComments(taskId));
    setLoading(false);
  };

  const onOpen = (o: boolean) => { setOpen(o); if (o) void load(); };

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    const optimistic: TaskComment = { id: `tmp-${Date.now()}`, author: 'You', body, when: 'just now' };
    setComments((c) => [...c, optimistic]);
    if (live) startTransition(async () => { await addTaskComment(taskId, body); await load(); });
  };

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Comments" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-muted hover:text-navy">
          <MessageSquare className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent title="Comments">
        <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-navy">{title}</p>
        <div className="mb-3 max-h-72 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet. Start the discussion.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-xl bg-muted/60 p-3">
                <p className="text-sm text-navy">{c.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.author} · {c.when}</p>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Add a comment…" />
          <Button size="icon" variant="brand" onClick={submit} aria-label="Send"><Send className="size-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
