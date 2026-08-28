'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plane, GraduationCap, Plus, Loader2, Sparkles, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  seedChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem,
} from '@/lib/actions/checklist';

export interface ChecklistItem { id: string; title: string; category: string; done: boolean; due: string | null }

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

const catTone: Record<string, string> = {
  visa: 'bg-danger/10 text-danger', bank: 'bg-brand-muted text-brand', travel: 'bg-success-soft text-success',
  accommodation: 'bg-attention-soft text-attention', packing: 'bg-muted text-navy', documents: 'bg-navy/10 text-navy',
};

export function MovePrep({
  studentId, name, items, nextDepartureISO, termStartISO, live, canManage,
}: {
  studentId: string;
  name: string;
  items: ChecklistItem[];
  nextDepartureISO: string | null;
  termStartISO: string | null;
  live: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  const flightDays = daysUntil(nextDepartureISO);
  const termDays = daysUntil(termStartISO);
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const act = (fn: () => Promise<unknown>) => start(async () => { if (live) await fn(); router.refresh(); });

  // Choose the most relevant countdown: an upcoming flight, else term start.
  const countdown = flightDays !== null && flightDays >= 0
    ? { icon: <Plane className="size-5" />, days: flightDays, label: `until ${name} flies to the UK` }
    : termDays !== null && termDays >= 0
      ? { icon: <GraduationCap className="size-5" />, days: termDays, label: 'until term starts' }
      : null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Move to the UK</p>
        {items.length > 0 && <span className="text-xs font-semibold text-muted-foreground">{done}/{items.length} done</span>}
      </div>

      {countdown && (
        <Card className="mb-3 flex items-center gap-3 bg-navy p-4 text-white">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">{countdown.icon}</span>
          <div>
            <p className="text-2xl font-extrabold leading-none">
              {countdown.days} <span className="text-base font-semibold text-white/80">day{countdown.days === 1 ? '' : 's'}</span>
            </p>
            <p className="text-sm text-white/80">{countdown.label}</p>
          </div>
        </Card>
      )}

      {items.length > 0 && (
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {items.length === 0 ? (
        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">No checklist yet.</p>
          {canManage && (
            <Button variant="brand" size="sm" className="mt-3" disabled={pending}
              onClick={() => act(() => seedChecklist(studentId))}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Add starter checklist
            </Button>
          )}
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 p-3">
              <button
                type="button" aria-label={it.done ? 'Mark not done' : 'Mark done'}
                onClick={() => act(() => toggleChecklistItem(it.id, studentId, !it.done))}
                className={'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors '
                  + (it.done ? 'border-success bg-success text-white' : 'border-navy-200 text-transparent hover:border-brand')}
              >
                <Check className="size-4" />
              </button>
              <span className={'flex-1 text-sm font-medium ' + (it.done ? 'text-muted-foreground line-through' : 'text-navy')}>
                {it.title}
              </span>
              {it.category && it.category !== 'other' && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${catTone[it.category] ?? 'bg-muted text-navy'}`}>{it.category}</span>
              )}
              {canManage && (
                <button type="button" aria-label="Remove" onClick={() => act(() => deleteChecklistItem(it.id, studentId))}
                  className="text-navy-300 hover:text-danger"><X className="size-4" /></button>
              )}
            </div>
          ))}
          {canManage && (
            <div className="p-3">
              {adding ? (
                <form
                  action={() => {
                    const t = title.trim();
                    if (!t) return;
                    setTitle(''); setAdding(false);
                    act(() => addChecklistItem({ studentId, title: t }));
                  }}
                  className="flex gap-2"
                >
                  <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add an item…" className="h-9" />
                  <Button type="submit" variant="brand" size="sm" disabled={pending}>Add</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setAdding(false); setTitle(''); }}>Cancel</Button>
                </form>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                  <Plus className="size-3.5" /> Add item
                </button>
              )}
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
