'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setTaskStatus, addSubtask } from '@/lib/actions/tasks';
import type { TaskStatus } from '@/lib/types';

export function TaskSubtasks({
  parentId, subtasks, live,
}: {
  parentId: string;
  subtasks: { id: string; title: string; status: TaskStatus }[];
  live: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(subtasks);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  const toggle = (id: string) => {
    let next: TaskStatus = 'todo';
    setItems((xs) => xs.map((s) => { if (s.id !== id) return s; next = s.status === 'done' ? 'todo' : 'done'; return { ...s, status: next }; }));
    if (live) startTransition(() => void setTaskStatus(id, next));
  };

  const add = () => {
    const title = draft.trim();
    if (!title) { setAdding(false); return; }
    setDraft('');
    setItems((xs) => [...xs, { id: `tmp-${Date.now()}`, title, status: 'todo' }]);
    if (live) startTransition(async () => { await addSubtask(parentId, title); router.refresh(); });
  };

  const done = items.filter((s) => s.status === 'done').length;

  if (items.length === 0 && !adding) {
    return (
      <button type="button" onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">
        <Plus className="size-3.5" /> Add subtask
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {items.length > 0 && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Subtasks · {done}/{items.length}</p>}
      {items.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <button type="button" onClick={() => toggle(s.id)} aria-label={s.status === 'done' ? 'Mark not done' : 'Mark done'}
            className={cn('flex size-4 shrink-0 items-center justify-center rounded border', s.status === 'done' ? 'border-success bg-success text-white' : 'border-navy-200 text-transparent')}>
            <Check className="size-3" />
          </button>
          <span className={cn('text-sm', s.status === 'done' ? 'text-muted-foreground line-through' : 'text-navy')}>{s.title}</span>
        </div>
      ))}
      {adding ? (
        <div className="flex items-center gap-2 pt-1">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }}
            autoFocus placeholder="Subtask…" className="h-8 flex-1 rounded-lg border border-input bg-white px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <button type="button" onClick={add} className="text-xs font-semibold text-brand">Add</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 pt-0.5 text-xs font-semibold text-brand">
          <Plus className="size-3.5" /> Add subtask
        </button>
      )}
    </div>
  );
}
