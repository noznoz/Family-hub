'use client';

import { useRef, useState, useTransition } from 'react';
import { Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { uploadMedia } from '@/lib/storage';
import { createTask, updateTask } from '@/lib/actions/tasks';
import type { Task, TaskPriority } from '@/lib/types';

export function TaskCreateDialog({
  trigger,
  live,
  familyId,
  students,
  members,
  onCreated,
  onSaved,
  task,
}: {
  trigger: React.ReactNode;
  live: boolean;
  familyId?: string;
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
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? (task?.assigneeId ? [task.assigneeId] : []));
  const [studentIds, setStudentIds] = useState<string[]>(task?.studentIds ?? (task?.studentId ? [task.studentId] : []));
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const onSubmit = (formData: FormData) => {
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '');
    const priority = String(formData.get('priority') ?? 'normal') as TaskPriority;
    const dueDate = String(formData.get('dueDate') ?? '') || null;
    const repeat = String(formData.get('repeat') ?? 'none');
    if (!title) {
      setError('Title is required.');
      return;
    }
    setError(null);
    const studentNames = studentIds.map((id) => students.find((s) => s.id === id)?.name).filter((n): n is string => !!n);
    const assigneeNames = assigneeIds.map((id) => members.find((m) => m.id === id)?.name).filter((n): n is string => !!n);
    const primaryStudent = studentNames[0];

    startTransition(async () => {
      let attachmentPath: string | undefined;
      if (file && live && familyId) {
        const safe = file.name.replace(/[^\w.\-]+/g, '_');
        const path = await uploadMedia(familyId, file, `tasks/${Date.now()}-${safe}`);
        if (!path) { setError('Attachment upload failed. Try again.'); return; }
        attachmentPath = path;
      }
      const res = isEdit
        ? await updateTask({ id: task!.id, title, description, priority, dueDate, assigneeIds, studentIds, repeat, ...(attachmentPath ? { attachmentPath } : {}) })
        : await createTask({ title, description, priority, dueDate, assigneeIds, studentIds, repeat, attachmentPath });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const next: Task = {
        id: task?.id ?? crypto.randomUUID(),
        title,
        description: description || undefined,
        assignee: assigneeNames[0],
        assignees: assigneeNames,
        student: (primaryStudent === 'Hamza' || primaryStudent === 'Omar' ? primaryStudent : null) as Task['student'],
        students: studentNames,
        due: dueDate ? new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null,
        priority,
        status: task?.status ?? 'todo',
        dueDate,
        studentId: studentIds[0] ?? null,
        studentIds,
        assigneeId: assigneeIds[0] ?? null,
        assigneeIds,
        repeat,
        attachmentUrl: attachmentPath ? '#' : task?.attachmentUrl ?? null,
      };
      if (isEdit) onSaved?.(next);
      else onCreated?.(next);
      setFile(null);
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
          <Field label={`Assign to${assigneeIds.length ? ` (${assigneeIds.length})` : ''}`}>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members to assign.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const on = assigneeIds.includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggle(setAssigneeIds)(m.id)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'border-brand bg-brand-muted text-brand' : 'border-border text-navy hover:bg-muted'}`}>
                      {on ? '✓ ' : ''}{m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
          <Field label={`Related student${studentIds.length ? ` (${studentIds.length})` : ''}`}>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {students.map((s) => {
                  const on = studentIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggle(setStudentIds)(s.id)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'border-navy bg-navy text-white' : 'border-border text-navy hover:bg-muted'}`}>
                      {on ? '✓ ' : ''}{s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
          <div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-semibold text-navy hover:bg-muted">
              <Paperclip className="size-4 text-navy-400" />
              {file ? file.name : task?.attachmentUrl ? 'Replace attachment' : 'Attach a file (optional)'}
            </button>
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
