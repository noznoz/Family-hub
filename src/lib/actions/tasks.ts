'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import type { TaskPriority, TaskStatus } from '@/lib/types';
import { notifyMembers } from '@/lib/notify';

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string | null;
  studentId?: string | null;
  assigneeId?: string | null;
  /** Multiple owners / related students. When present these win; the single
   *  id fields are kept in sync with the first entry for compatibility. */
  assigneeIds?: string[];
  studentIds?: string[];
  repeat?: string | null;   // 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  attachmentPath?: string | null;
}

type Result = { ok: true } | { ok: false; error: string };

/** Normalise possibly-multi input to a de-duplicated list plus a primary id. */
function idsOf(single: string | null | undefined, multi: string[] | undefined): { list: string[]; primary: string | null } {
  const list = Array.from(new Set([...(multi ?? []), ...(single ? [single] : [])].filter(Boolean))) as string[];
  return { list, primary: list[0] ?? null };
}

/** Replace the assignee/student join rows for a task. */
async function setTaskLinks(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  taskId: string,
  assigneeIds: string[],
  studentIds: string[],
) {
  await supabase.from('task_assignees').delete().eq('task_id', taskId);
  if (assigneeIds.length) {
    await supabase.from('task_assignees').insert(assigneeIds.map((member_id) => ({ task_id: taskId, member_id })));
  }
  await supabase.from('task_students').delete().eq('task_id', taskId);
  if (studentIds.length) {
    await supabase.from('task_students').insert(studentIds.map((student_id) => ({ task_id: taskId, student_id })));
  }
}

/** Advance an ISO date (YYYY-MM-DD) by one recurrence period. */
function advance(dateIso: string, freq: string): string {
  const d = new Date(dateIso + 'T00:00:00');
  if (freq === 'daily') d.setDate(d.getDate() + 1);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

async function setRecurrence(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  taskId: string,
  repeat: string | null | undefined,
) {
  await supabase.from('task_recurrences').delete().eq('task_id', taskId);
  if (repeat && repeat !== 'none') {
    await supabase.from('task_recurrences').insert({ task_id: taskId, frequency: repeat, interval_n: 1, active: true });
  }
}

/** Create a task. No-op success in demo mode (client keeps optimistic state). */
export async function createTask(input: CreateTaskInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!isSupabaseConfigured) return { ok: true };

  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const assignees = idsOf(input.assigneeId, input.assigneeIds);
  const students = idsOf(input.studentId, input.studentIds);

  const { data: created, error } = await supabase.from('tasks').insert({
    family_id: session.familyId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    priority: input.priority,
    due_date: input.dueDate || null,
    student_id: students.primary,
    assignee_id: assignees.primary,
    attachment_url: input.attachmentPath || null,
    created_by: user?.id ?? null,
  }).select('id').single();
  if (error) return { ok: false, error: error.message };
  if (created) {
    await setRecurrence(supabase, created.id, input.repeat);
    await setTaskLinks(supabase, created.id, assignees.list, students.list);
  }

  // Notify every assignee (in-app + push + email), except the person creating it.
  const notify = assignees.list.filter((id) => id !== session.memberId);
  if (notify.length) {
    try {
      await notifyMembers({
        familyId: session.familyId,
        memberIds: notify,
        title: 'New task assigned to you',
        body: `${session.member.displayName} assigned you: ${input.title.trim()}`,
        url: '/tasks',
        kind: 'family_update',
      });
    } catch {}
  }

  revalidatePath('/tasks');
  revalidatePath('/home');
  return { ok: true };
}

export interface UpdateTaskInput extends CreateTaskInput {
  id: string;
}

/** Update a task's editable fields. */
export async function updateTask(input: UpdateTaskInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const session = await getSessionUser();
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  // Note the current assignees so we only notify people newly added.
  const { data: prevRows } = await supabase.from('task_assignees').select('member_id').eq('task_id', input.id);
  const prevAssignees = new Set((prevRows ?? []).map((r) => r.member_id as string));

  const assignees = idsOf(input.assigneeId, input.assigneeIds);
  const students = idsOf(input.studentId, input.studentIds);

  const { error } = await supabase
    .from('tasks')
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: input.priority,
      due_date: input.dueDate || null,
      student_id: students.primary,
      assignee_id: assignees.primary,
      ...(input.attachmentPath !== undefined ? { attachment_url: input.attachmentPath } : {}),
    })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  if (input.repeat !== undefined) await setRecurrence(supabase, input.id, input.repeat);
  await setTaskLinks(supabase, input.id, assignees.list, students.list);

  // Notify anyone newly assigned (not previously on the task, not the editor).
  const newlyAssigned = session
    ? assignees.list.filter((id) => !prevAssignees.has(id) && id !== session.memberId)
    : [];
  if (newlyAssigned.length && session) {
    try {
      await notifyMembers({
        familyId: session.familyId,
        memberIds: newlyAssigned,
        title: 'A task was assigned to you',
        body: `${session.member.displayName} assigned you: ${input.title.trim()}`,
        url: '/tasks',
        kind: 'family_update',
      });
    } catch {}
  }

  revalidatePath('/tasks');
  revalidatePath('/home');
  return { ok: true };
}

/** Update a task's status; sets completed_at when moving to done. */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };

  const { error } = await supabase
    .from('tasks')
    .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  // If a completed task recurs, spawn the next occurrence and carry the
  // recurrence forward to it (so the series keeps rolling).
  if (status === 'done') {
    const { data: rec } = await supabase
      .from('task_recurrences').select('id, frequency').eq('task_id', id).eq('active', true).maybeSingle();
    if (rec) {
      const { data: t } = await supabase
        .from('tasks').select('family_id, title, description, priority, student_id, assignee_id, due_date, created_by').eq('id', id).single();
      if (t) {
        const base = t.due_date ?? new Date().toISOString().slice(0, 10);
        const nextDue = advance(base, rec.frequency);
        const { data: next } = await supabase.from('tasks').insert({
          family_id: t.family_id, title: t.title, description: t.description, priority: t.priority,
          student_id: t.student_id, assignee_id: t.assignee_id, due_date: nextDue, status: 'todo', created_by: t.created_by,
        }).select('id').single();
        if (next) {
          await supabase.from('task_recurrences').update({ active: false }).eq('id', rec.id);
          await supabase.from('task_recurrences').insert({ task_id: next.id, frequency: rec.frequency, interval_n: 1, active: true });
          // Carry the full set of owners & related students to the next occurrence.
          const [{ data: aRows }, { data: sRows }] = await Promise.all([
            supabase.from('task_assignees').select('member_id').eq('task_id', id),
            supabase.from('task_students').select('student_id').eq('task_id', id),
          ]);
          if (aRows?.length) await supabase.from('task_assignees').insert(aRows.map((r) => ({ task_id: next.id, member_id: r.member_id })));
          if (sRows?.length) await supabase.from('task_students').insert(sRows.map((r) => ({ task_id: next.id, student_id: r.student_id })));
        }
      }
    }
  }

  revalidatePath('/tasks');
  revalidatePath('/home');
  return { ok: true };
}

/** Add a subtask under a parent task. */
export async function addSubtask(parentId: string, title: string): Promise<Result> {
  if (!title.trim()) return { ok: false, error: 'Title is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('tasks').insert({
    family_id: session.familyId, title: title.trim(), priority: 'normal', status: 'todo',
    parent_task_id: parentId, created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/tasks');
  return { ok: true };
}

export interface TaskComment { id: string; author: string; body: string; when: string }

export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('task_comments')
    .select('id, body, created_at, author:profiles(full_name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  return (data ?? []).map((c) => ({
    id: c.id,
    author: (Array.isArray(c.author) ? c.author[0]?.full_name : (c.author as { full_name?: string } | null)?.full_name) || 'Someone',
    body: c.body,
    when: new Date(c.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  }));
}

export async function addTaskComment(taskId: string, body: string): Promise<Result> {
  if (!body.trim()) return { ok: false, error: 'Comment is empty.' };
  if (!isSupabaseConfigured) return { ok: true };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('task_comments').insert({ task_id: taskId, author_id: user?.id ?? null, body: body.trim() });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/tasks');
  return { ok: true };
}

export async function deleteTask(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/tasks');
  return { ok: true };
}
