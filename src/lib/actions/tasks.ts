'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import type { TaskPriority, TaskStatus } from '@/lib/types';

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string | null;
  studentId?: string | null;
  assigneeId?: string | null;
}

type Result = { ok: true } | { ok: false; error: string };

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

  const { error } = await supabase.from('tasks').insert({
    family_id: session.familyId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    priority: input.priority,
    due_date: input.dueDate || null,
    student_id: input.studentId || null,
    assignee_id: input.assigneeId || null,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };

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

  revalidatePath('/tasks');
  revalidatePath('/home');
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
