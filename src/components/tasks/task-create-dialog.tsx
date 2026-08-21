'use client';

import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createTask, updateTask } from '@/lib/actions/tasks';
import type { Task, TaskPriority } from '@/lib/types';

export function TaskCreateDialog({
  trigger,
  live,
  students,
  members,
  onCreated,
  onSaved,
  task,
}: {
  trigger: React.ReactNode;
  live: boolean;
  students: { id: string; name: string }[];
  members: { id: string; name: string }[];
  onCreated?: (t: Task) => void;
  onSaved?: (t: Task) => void;
  /** When provided, the dialog edits this task instead of creating a new one. */
  task?: Task;
}) {
  const isEdit = !!task;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (formData: FormData) => {
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '');
    const priority = String(formData.get('priority') ?? 'normal') as TaskPriority;
    const dueDate = String(formData.get('dueDate') ?? '') || null;
    const studentId = String(formData.get('studentId') ?? '') || null;
    const assigneeId = String(formData.get('assigneeId') ?? '') || null;
    const repeat = String(formData.get('repeat') ?? 'none');
    if (!title) {
      setError('Title is required.');
      return;
    }
    setError(null);
    const studentName = students.find((s) => s.id === studentId)?.name;
    const assigneeName = members.find((m) => m.id === assigneeId)?.name;

    startTransition(async () => {
      const res = isEdit
        ? await updateTask({ id: task!.id, title, description, priority, dueDate, studentId, assigneeId, repeat })
        : await createTask({ title, description, priority, dueDate, studentId, assigneeId, repeat });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const next: Task = {
        id: task?.id ?? crypto.randomUUID(),
        title,
        description: description || undefined,
        assignee: assigneeName,
        student: (studentName === 'Hamza' || studentName === 'Omar' ? studentName : null) as Task['student'],
        due: dueDate ? new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null,
        priority,
        status: task?.status ?? 'todo',
        dueDate,
        studentId,
        assigneeId,
        repeat,
      };
      if (isEdit) onSaved?.(next);
      else onCreated?.(next);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={isEdit ? 'Edit task' : 'New task'}>
        <form action={onSubmit} className="space-y-3">
          <Field label="Title" htmlFor="title">
            <Input id="title" name="title" required defaultValue={task?.title} placeholder="e.g. Pay tuition (Term 1)" />
          </Field>
          <Field label="Description" htmlFor="description">
            <Input id="description" name="description" defaultValue={task?.description} placeholder="Optional details" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority" htmlFor="priority">
              <Select id="priority" name="priority" defaultValue={task?.priority ?? 'normal'}>
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
            <Field label="Due date" htmlFor="dueDate">
              <Input id="dueDate" name="dueDate" type="date" defaultValue={task?.dueDate ?? undefined} />
            </Field>
          </div>
          <Field label="Repeat" htmlFor="repeat">
            <Select id="repeat" name="repeat" defaultValue={task?.repeat ?? 'none'}>
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Related student" htmlFor="studentId">
              <Select id="studentId" name="studentId" defaultValue={task?.studentId ?? ''}>
                <option value="">None</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Assign to" htmlFor="assigneeId">
              <Select id="assigneeId" name="assigneeId" defaultValue={task?.assigneeId ?? ''}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          {!live && (
            <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">
              Demo mode — {isEdit ? 'changes are local only.' : 'added locally only.'} Connect Supabase to persist tasks.
            </p>
          )}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="flex-1">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
