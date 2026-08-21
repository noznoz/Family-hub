'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import { can } from '@/lib/permissions';
import type { ExpenseCategory, TaskPriority } from '@/lib/types';
import { sendPushToMember } from '@/lib/push';

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
  receiptPath?: string | null;
}

export async function createExpense(input: ExpenseInput): Promise<Result> {
  if (!input.amount || input.amount <= 0) return { ok: false, error: 'Enter a valid amount.' };
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };
  if (!can(c.session.member.role, 'manage_student_finances', c.session.overrides)) return { ok: false, error: 'No permission to add expenses.' };

  const { error } = await c.supabase.from('expenses').insert({
    family_id: c.session.familyId,
    student_id: input.studentId,
    funding_id: input.fundingId || null,
    category: input.category,
    amount: input.amount,
    currency: input.currency || 'GBP',
    description: input.description || null,
    spent_on: input.spentOn || new Date().toISOString().slice(0, 10),
    receipt_path: input.receiptPath || null,
    created_by: c.userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/money');
  return { ok: true };
}

/** Set (or clear) a student's budget for the current month. */
export async function setBudget(studentId: string, amount: number, currency = 'GBP'): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };
  if (!can(c.session.member.role, 'manage_student_finances', c.session.overrides)) return { ok: false, error: 'No permission to set budgets.' };

  const monthStart = new Date();
  monthStart.setDate(1);
  const month = monthStart.toISOString().slice(0, 10);

  const { error } = await c.supabase.from('budgets').upsert({
    family_id: c.session.familyId,
    student_id: studentId,
    month,
    amount,
    currency,
  }, { onConflict: 'student_id,month' });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/money');
  revalidatePath('/home');
  return { ok: true };
}

export interface UpdateExpenseInput extends ExpenseInput {
  id: string;
}

export async function updateExpense(input: UpdateExpenseInput): Promise<Result> {
  if (!input.amount || input.amount <= 0) return { ok: false, error: 'Enter a valid amount.' };
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };
  if (!can(c.session.member.role, 'manage_student_finances', c.session.overrides)) return { ok: false, error: 'No permission to edit expenses.' };

  const { error } = await c.supabase.from('expenses').update({
    student_id: input.studentId,
    category: input.category,
    amount: input.amount,
    description: input.description || null,
    spent_on: input.spentOn || undefined,
    ...(input.receiptPath !== undefined ? { receipt_path: input.receiptPath } : {}),
  }).eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/money');
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };
  if (!can(c.session.member.role, 'manage_student_finances', c.session.overrides)) return { ok: false, error: 'No permission to delete expenses.' };
  const { error } = await c.supabase.from('expenses').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  await audit(c.session.familyId, c.userId, 'expense.delete', 'expense', id, {});
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

  // Notify approvers (admins/parents) of the new request.
  try {
    const { data: approvers } = await c.supabase
      .from('family_members').select('id')
      .eq('family_id', c.session.familyId).eq('status', 'active').in('role', ['admin', 'parent']);
    const who = c.session.member.displayName;
    await Promise.all((approvers ?? [])
      .filter((a) => a.id !== c.session.memberId)
      .map((a) => sendPushToMember(a.id, { title: 'New payment request', body: `${who} requested ${input.currency || 'GBP'} ${input.amount} — ${input.reason.trim()}`, url: '/money' })));
  } catch {}

  revalidatePath('/money');
  revalidatePath('/home');
  return { ok: true };
}

export interface UpdateRequestInput extends RequestInput {
  id: string;
}

/** Can the current member change this request? The requester (while still
 *  pending) or anyone who can approve requests. */
async function canEditRequest(
  c: NonNullable<Awaited<ReturnType<typeof ctx>>>,
  id: string,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { data: row } = await c.supabase
    .from('payment_requests').select('requested_by, status').eq('id', id).maybeSingle();
  if (!row) return { ok: false, error: 'Request not found.' };
  const isOwner = row.requested_by === c.session.memberId;
  const isApprover = can(c.session.member.role, 'approve_payment_requests', c.session.overrides);
  if (!isOwner && !isApprover) return { ok: false, error: 'No permission.' };
  return { ok: true, status: row.status };
}

export async function updatePaymentRequest(input: UpdateRequestInput): Promise<Result> {
  if (!input.amount || input.amount <= 0) return { ok: false, error: 'Enter a valid amount.' };
  if (!input.reason.trim()) return { ok: false, error: 'Add a reason.' };
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };
  const gate = await canEditRequest(c, input.id);
  if (!gate.ok) return { ok: false, error: gate.error! };
  if (gate.status !== 'requested') return { ok: false, error: 'Only pending requests can be edited.' };

  const { error } = await c.supabase.from('payment_requests').update({
    student_id: input.studentId,
    amount: input.amount,
    reason: input.reason.trim(),
    category: input.category,
    urgency: input.urgency,
    note: input.note || null,
  }).eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/money');
  return { ok: true };
}

export async function deletePaymentRequest(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };
  const gate = await canEditRequest(c, id);
  if (!gate.ok) return { ok: false, error: gate.error! };
  const { error } = await c.supabase.from('payment_requests').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  await audit(c.session.familyId, c.userId, 'payment.delete', 'payment_request', id, {});
  revalidatePath('/money');
  revalidatePath('/home');
  return { ok: true };
}

export async function decidePaymentRequest(id: string, decision: 'approved' | 'rejected'): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };
  if (!can(c.session.member.role, 'approve_payment_requests', c.session.overrides)) return { ok: false, error: 'No permission to approve.' };

  const { data: reqRow } = await c.supabase.from('payment_requests').select('requested_by, amount, currency, reason').eq('id', id).maybeSingle();
  const { error } = await c.supabase
    .from('payment_requests')
    .update({ status: decision, decided_by: c.userId, decided_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  await audit(c.session.familyId, c.userId, `payment.${decision}`, 'payment_request', id, {});
  if (reqRow?.requested_by) {
    try { await sendPushToMember(reqRow.requested_by, { title: `Payment ${decision}`, body: `Your request for ${reqRow.currency} ${reqRow.amount} was ${decision}.`, url: '/money' }); } catch {}
  }
  revalidatePath('/money');
  return { ok: true };
}

/** Mark a request paid, optionally recording it as an expense. */
export async function markPaid(id: string, alsoCreateExpense: boolean): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c) return { ok: false, error: 'Not signed in.' };
  if (!can(c.session.member.role, 'approve_payment_requests', c.session.overrides)) return { ok: false, error: 'No permission.' };

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
