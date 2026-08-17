'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import { can } from '@/lib/permissions';
import type { ExpenseCategory, TaskPriority } from '@/lib/types';

type Result = { ok: true } | { ok: false; error: string };

async function ctx() {
  const session = await getSessionUser();
  if (!session) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return { session, supabase, userId: user?.id ?? null };
}

async function audit(familyId: string, actorId: string | null, action: string, entity: string, entityId: string, meta: object) {
  const supabase = await createClient();
  await supabase?.from('audit_logs').insert({ family_id: familyId, actor_id: actorId, action, entity, entity_id: entityId, meta });
}

export interface ExpenseInput {
  studentId: string;
  fundingId?: string | null;
  category: ExpenseCategory;
  amount: number;
  currency?: string;
  description?: string;
  spentOn?: string;
}

export async function createExpense(input: ExpenseInput): Promise<Result> {
  if (!input.amount || input.amount <= 0) return { ok: false, error: 'Enter a valid amount.' };
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };
  if (!can(c.session.member.role, 'manage_student_finances')) return { ok: false, error: 'No permission to add expenses.' };

  const { error } = await c.supabase.from('expenses').insert({
    family_id: c.session.familyId,
    student_id: input.studentId,
    funding_id: input.fundingId || null,
    category: input.category,
    amount: input.amount,
    currency: input.currency || 'GBP',
    description: input.description || null,
    spent_on: input.spentOn || new Date().toISOString().slice(0, 10),
    created_by: c.userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/money');
  return { ok: true };
}

export interface RequestInput {
  studentId: string;
  amount: number;
  currency?: string;
  reason: string;
  category: ExpenseCategory;
  urgency: TaskPriority;
  note?: string;
}

export async function createPaymentRequest(input: RequestInput): Promise<Result> {
  if (!input.amount || input.amount <= 0) return { ok: false, error: 'Enter a valid amount.' };
  if (!input.reason.trim()) return { ok: false, error: 'Add a reason.' };
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };

  const { error } = await c.supabase.from('payment_requests').insert({
    family_id: c.session.familyId,
    student_id: input.studentId,
    amount: input.amount,
    currency: input.currency || 'GBP',
    reason: input.reason.trim(),
    category: input.category,
    urgency: input.urgency,
    note: input.note || null,
    requested_by: c.session.memberId,
    status: 'requested',
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/money');
  revalidatePath('/home');
  return { ok: true };
}

export async function decidePaymentRequest(id: string, decision: 'approved' | 'rejected'): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };
  if (!can(c.session.member.role, 'approve_payment_requests')) return { ok: false, error: 'No permission to approve.' };

  const { error } = await c.supabase
    .from('payment_requests')
    .update({ status: decision, decided_by: c.userId, decided_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  await audit(c.session.familyId, c.userId, `payment.${decision}`, 'payment_request', id, {});
  revalidatePath('/money');
  return { ok: true };
}

/** Mark a request paid, optionally recording it as an expense. */
export async function markPaid(id: string, alsoCreateExpense: boolean): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };
  if (!can(c.session.member.role, 'approve_payment_requests')) return { ok: false, error: 'No permission.' };

  const { data: req, error: rerr } = await c.supabase
    .from('payment_requests').select('*').eq('id', id).single();
  if (rerr || !req) return { ok: false, error: rerr?.message ?? 'Not found.' };

  let expenseId: string | null = null;
  if (alsoCreateExpense) {
    const { data: exp } = await c.supabase.from('expenses').insert({
      family_id: req.family_id,
      student_id: req.student_id,
      category: req.category,
      amount: req.amount,
      currency: req.currency,
      description: req.reason,
      spent_on: new Date().toISOString().slice(0, 10),
      created_by: c.userId,
    }).select('id').single();
    expenseId = exp?.id ?? null;
  }

  const { error } = await c.supabase
    .from('payment_requests')
    .update({ status: 'paid', decided_by: c.userId, decided_at: new Date().toISOString(), paid_expense_id: expenseId })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  await audit(c.session.familyId, c.userId, 'payment.paid', 'payment_request', id, { expenseId });
  revalidatePath('/money');
  revalidatePath('/home');
  return { ok: true };
}
