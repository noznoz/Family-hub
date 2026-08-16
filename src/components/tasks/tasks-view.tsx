'use client';

import { useMemo, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';

const FILTERS = ['My Tasks', 'Hamza', 'Omar', 'Family', 'Completed'] as const;
type Filter = (typeof FILTERS)[number];

const priorityTone: Record<TaskPriority, 'neutral' | 'attention' | 'danger'> = {
  normal: 'neutral',
  important: 'attention',
  urgent: 'danger',
};
const statusLabel: Record<TaskStatus, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

export function TasksView({ tasks: initial }: { tasks: Task[] }) {
  const [tasks, setTasks] = useState(initial);
  const [filter, setFilter] = useState<Filter>('My Tasks');

  const filtered = useMemo(() => {
    switch (filter) {
      case 'Completed':
        return tasks.filter((t) => t.status === 'done');
      case 'Hamza':
        return tasks.filter((t) => t.student === 'Hamza' && t.status !== 'done');
      case 'Omar':
        return tasks.filter((t) => t.student === 'Omar' && t.status !== 'done');
      case 'Family':
        return tasks.filter((t) => !t.student && t.status !== 'done');
      default:
        return tasks.filter((t) => t.status !== 'done');
    }
  }, [tasks, filter]);

  const toggle = (id: string) =>
    setTasks((ts) =>
      ts.map((t) => (t.id === id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t)),
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Tasks</h1>
        <Button variant="brand" size="sm"><Plus className="size-4" /> New</Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
              filter === f ? 'bg-navy text-white' : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No tasks here 🎉" hint="Nothing to do in this view right now." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Card key={t.id} className="flex items-start gap-3 p-4">
              <button
                onClick={() => toggle(t.id)}
                aria-label={t.status === 'done' ? 'Mark as not done' : 'Mark as done'}
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  t.status === 'done' ? 'border-success bg-success text-white' : 'border-navy-200 text-transparent hover:border-brand',
                )}
              >
                <Check className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('font-semibold text-navy', t.status === 'done' && 'text-muted-foreground line-through')}>
                  {t.title}
                </p>
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {t.student && <Chip tone="navy">{t.student}</Chip>}
                  {t.assignee && <Chip tone="neutral">{t.assignee}</Chip>}
                  {t.priority !== 'normal' && <Chip tone={priorityTone[t.priority]}>{t.priority}</Chip>}
                  {t.status !== 'done' && <Chip tone="brand">{statusLabel[t.status]}</Chip>}
                  {t.due && <span className="text-xs font-semibold text-muted-foreground">{t.due}</span>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
