'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, Check, Paperclip } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton } from '@/components/ui/delete-button';
import { ReminderButton } from '@/components/ui/reminder-button';
import { ShareButton } from '@/components/ui/share-button';
import { cn } from '@/lib/utils';
import { setTaskStatus, deleteTask } from '@/lib/actions/tasks';
import { TaskCreateDialog } from './task-create-dialog';
import { TaskCommentsDialog } from './task-comments-dialog';
import { TaskSubtasks } from './task-subtasks';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';

const FILTERS = ['My Tasks', 'Hamza', 'Omar', 'Family', 'Completed'] as const;
type Filter = (typeof FILTERS)[number];

const priorityTone: Record<TaskPriority, 'neutral' | 'attention' | 'danger'> = {
  normal: 'neutral',
  important: 'attention',
  urgent: 'danger',
};
const statusLabel: Record<TaskStatus, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

export function TasksView({
  tasks: initial,
  live,
  meId,
  familyId,
  students,
  members,
}: {
  tasks: Task[];
  live: boolean;
  meId: string;
  familyId: string;
  students: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const [tasks, setTasks] = useState(initial);
  const [filter, setFilter] = useState<Filter>('My Tasks');
  const [, startTransition] = useTransition();

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

  const toggle = (id: string) => {
    let next: TaskStatus = 'todo';
    setTasks((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        next = t.status === 'done' ? 'todo' : 'done';
        return { ...t, status: next };
      }),
    );
    if (live) startTransition(() => void setTaskStatus(id, next));
  };

  const onCreated = (t: Task) => setTasks((ts) => [t, ...ts]);
  const onSaved = (t: Task) => setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)));
  const onDeleted = (id: string) => setTasks((ts) => ts.filter((t) => t.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Tasks</h1>
        <TaskCreateDialog
          live={live}
          familyId={familyId}
          students={students}
          members={members}
          onCreated={onCreated}
          trigger={<Button variant="brand" size="sm"><Plus className="size-4" /> New</Button>}
        />
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
                <TaskCreateDialog
                  live={live}
                  familyId={familyId}
                  students={students}
                  members={members}
                  task={t}
                  onSaved={onSaved}
                  trigger={
                    <button type="button" className="group block w-full text-left" aria-label={`Open ${t.title}`}>
                      <p className={cn('font-semibold text-navy group-hover:text-brand', t.status === 'done' && 'text-muted-foreground line-through')}>
                        {t.title}
                      </p>
                      {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                    </button>
                  }
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {t.student && <Chip tone="navy">{t.student}</Chip>}
                  {t.assignee && <Chip tone="neutral">{t.assignee}</Chip>}
                  {t.priority !== 'normal' && <Chip tone={priorityTone[t.priority]}>{t.priority}</Chip>}
                  {t.repeat && t.repeat !== 'none' && <Chip tone="neutral">🔁 {t.repeat}</Chip>}
                  {t.status !== 'done' && <Chip tone="brand">{statusLabel[t.status]}</Chip>}
                  {t.due && <span className="text-xs font-semibold text-muted-foreground">{t.due}</span>}
                  {t.attachmentUrl && (
                    <a href={t.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                      <Paperclip className="size-3" /> File
                    </a>
                  )}
                </div>
                {t.status !== 'done' && <TaskSubtasks parentId={t.id} subtasks={t.subtasks ?? []} live={live} />}
              </div>
              <div className="flex shrink-0 items-center">
                <TaskCommentsDialog taskId={t.id} title={t.title} live={live} />
                <ShareButton
                  text={`📋 Task: ${t.title}${t.description ? `\n${t.description}` : ''}${t.due ? `\n🗓 Due: ${t.due}` : ''}${t.assignee ? `\n👤 ${t.assignee}` : ''}`}
                  url="/tasks"
                />
                <ReminderButton
                  entityType="task"
                  entityId={t.id}
                  title={t.title}
                  link="/tasks"
                  live={live}
                  meId={meId}
                  members={members}
                />
                <DeleteButton
                  itemLabel={`“${t.title}”`}
                  title="Delete task"
                  onConfirm={() => (live ? deleteTask(t.id) : Promise.resolve())}
                  onDeleted={() => onDeleted(t.id)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
