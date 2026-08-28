'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';

type Result = { ok: true } | { ok: false; error: string };

async function ctx() {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, error: 'Backend unavailable.' };
  const { data: { user } } = await supabase.auth.getUser();
  return { ok: true as const, session, supabase, userId: user?.id ?? null };
}

/** Default pre-departure items, grouped by category. */
export const DEFAULT_CHECKLIST: { title: string; category: string }[] = [
  { title: 'Confirm student visa / entry clearance', category: 'visa' },
  { title: 'Book flight to the UK', category: 'travel' },
  { title: 'Plan BRP collection (first 10 days)', category: 'visa' },
  { title: 'Open a UK bank account', category: 'bank' },
  { title: 'Get a UK SIM / mobile plan', category: 'sim' },
  { title: 'Arrange travel & health insurance', category: 'insurance' },
  { title: 'Pay accommodation deposit / first rent', category: 'accommodation' },
  { title: 'Register with a local GP', category: 'health' },
  { title: 'Pack essentials (adapters, documents, clothes)', category: 'packing' },
  { title: 'Copy key documents (passport, CAS, offer letter)', category: 'documents' },
];

export async function seedChecklist(studentId: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c.ok) return c;
  const rows = DEFAULT_CHECKLIST.map((it, i) => ({
    family_id: c.session.familyId, student_id: studentId,
    title: it.title, category: it.category, sort_order: i, created_by: c.userId,
  }));
  const { error } = await c.supabase.from('student_checklist_items').insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function addChecklistItem(input: { studentId: string; title: string; category?: string; dueDate?: string | null }): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Enter an item.' };
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from('student_checklist_items').insert({
    family_id: c.session.familyId, student_id: input.studentId,
    title: input.title.trim(), category: input.category || 'other',
    due_date: input.dueDate || null, sort_order: 999, created_by: c.userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/students/${input.studentId}`);
  return { ok: true };
}

export async function toggleChecklistItem(id: string, studentId: string, done: boolean): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from('student_checklist_items').update({ done }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function deleteChecklistItem(id: string, studentId: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from('student_checklist_items').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}
