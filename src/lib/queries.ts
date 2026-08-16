import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  Member, StudentSummary, Task, AttentionItem, Expense, PaymentRequest,
  TaskPriority, TaskStatus, ExpenseCategory,
} from '@/lib/types';
import type { SystemRole } from '@/lib/permissions';
import { dueLabel } from '@/lib/utils';

/**
 * Live data access. Every read runs through the authenticated Supabase client,
 * so Row Level Security applies. Pages fall back to demo data when Supabase is
 * not configured (see each page and src/lib/env.ts).
 */

/**
 * Normalize a Supabase embedded relation, which the untyped client may return
 * as either a single object or a one-element array, into a single object.
 */
function one<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

function fundingKind(kind: string): StudentSummary['fundingKind'] {
  if (kind === 'government_scholarship') return 'government_scholarship';
  if (kind === 'family_funded') return 'family_funded';
  if (kind === 'personal') return 'personal';
  return 'other';
}

export async function getFamilyMembers(familyId: string): Promise<Member[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('family_members')
    .select('id, display_name, role, is_student, status, relationships:family_relationships!family_relationships_member_id_fkey(relationship)')
    .eq('family_id', familyId)
    .neq('status', 'disabled')
    .order('created_at', { ascending: true });

  return (data ?? []).map((m) => ({
    id: m.id,
    displayName: m.display_name,
    role: m.role as SystemRole,
    isStudent: m.is_student,
    relationship:
      (m.relationships as { relationship: string }[] | null)?.[0]?.relationship?.replace(/_/g, ' ') ??
      (m.is_student ? 'Son' : 'Family'),
  }));
}

interface StudentRow {
  id: string;
  member_id: string;
  course: string | null;
  overall_status: string | null;
  status: string;
  member: { display_name: string } | null;
  university: { name: string } | null;
}

export async function getStudents(familyId: string): Promise<StudentSummary[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('student_profiles')
    .select('id, member_id, course, overall_status, status, member:family_members!student_profiles_member_id_fkey(display_name), university:universities(name)')
    .eq('family_id', familyId);

  const rows = (data ?? []) as unknown as StudentRow[];
  const students = await Promise.all(rows.map((r) => enrichStudent(r)));
  return students;
}

async function enrichStudent(r: StudentRow): Promise<StudentSummary> {
  const supabase = await createClient();
  const name = r.member?.display_name ?? 'Student';

  const [yearRes, fundingRes, taskRes, tripRes, reqRes] = await Promise.all([
    supabase!.from('academic_years').select('label, study_year')
      .eq('student_id', r.id).eq('status', 'active').limit(1).maybeSingle(),
    supabase!.from('funding_sources').select('label, kind')
      .eq('student_id', r.id).eq('status', 'active').order('start_date', { ascending: false }).limit(1).maybeSingle(),
    supabase!.from('tasks').select('title, due_date')
      .eq('student_id', r.id).neq('status', 'done').order('due_date', { ascending: true }).limit(1).maybeSingle(),
    supabase!.from('trip_members').select('trip:trips(title, depart_at)')
      .eq('member_id', r.member_id).limit(5),
    supabase!.from('payment_requests').select('reason, amount, currency, created_at')
      .eq('student_id', r.id).eq('status', 'requested').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const trips = (tripRes.data ?? [])
    .map((t) => t.trip as unknown as { title: string; depart_at: string } | null)
    .filter((t): t is { title: string; depart_at: string } => !!t?.depart_at && new Date(t.depart_at) > new Date())
    .sort((a, b) => +new Date(a.depart_at) - +new Date(b.depart_at));

  const year = yearRes.data;
  const funding = fundingRes.data;
  const task = taskRes.data;
  const req = reqRes.data;

  return {
    id: r.id,
    memberId: r.member_id,
    name,
    university: r.university?.name ?? '—',
    academicYear: year ? `Year ${year.study_year ?? '?'} · ${year.label}` : 'Not enrolled',
    funding: funding?.label ?? 'No funding set',
    fundingKind: fundingKind(funding?.kind ?? 'other'),
    overallStatus: r.overall_status ?? (r.status === 'graduated' ? 'Graduated' : 'On track'),
    nextTask: task ? { title: task.title, due: dueLabel(task.due_date) } : null,
    nextPayment: req ? { label: req.reason, amount: Number(req.amount), currency: req.currency, due: '' } : null,
    nextTrip: trips[0] ? { label: trips[0].title, date: dueLabel(trips[0].depart_at) } : null,
  };
}

export async function getTasks(familyId: string): Promise<Task[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('tasks')
    .select('id, title, description, priority, status, due_date, assignee:family_members!tasks_assignee_id_fkey(display_name), student:student_profiles(member:family_members!student_profiles_member_id_fkey(display_name))')
    .eq('family_id', familyId)
    .order('due_date', { ascending: true });

  return (data ?? []).map((t) => {
    const studentName = one<{ member: { display_name: string } | null }>(t.student)?.member?.display_name;
    return {
      id: t.id,
      title: t.title,
      description: t.description ?? undefined,
      assignee: one<{ display_name: string }>(t.assignee)?.display_name ?? undefined,
      student: (studentName === 'Hamza' || studentName === 'Omar' ? studentName : null) as Task['student'],
      due: t.due_date ? dueLabel(t.due_date) : null,
      priority: t.priority as TaskPriority,
      status: t.status as TaskStatus,
    };
  });
}

export async function getAttention(familyId: string): Promise<AttentionItem[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const items: AttentionItem[] = [];

  const { data: reqs } = await supabase
    .from('payment_requests')
    .select('id, amount, currency, reason, requested_by:family_members!payment_requests_requested_by_fkey(display_name)')
    .eq('family_id', familyId).eq('status', 'requested').limit(3);
  for (const r of reqs ?? []) {
    const who = one<{ display_name: string }>(r.requested_by)?.display_name ?? 'Someone';
    items.push({ id: `req-${r.id}`, title: 'New payment request', detail: `${who} requested ${r.currency} ${r.amount} — ${r.reason}`, tone: 'brand' });
  }

  const soon = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const { data: docs } = await supabase
    .from('documents')
    .select('id, name, expiry_date')
    .eq('family_id', familyId).not('expiry_date', 'is', null).lte('expiry_date', soon).limit(3);
  for (const d of docs ?? []) {
    items.push({ id: `doc-${d.id}`, title: `${d.name} expiring`, detail: `Expires ${d.expiry_date}`, tone: 'attention' });
  }

  const dueSoon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, priority')
    .eq('family_id', familyId).neq('status', 'done').not('due_date', 'is', null).lte('due_date', dueSoon).limit(4);
  for (const t of tasks ?? []) {
    items.push({ id: `task-${t.id}`, title: t.title, detail: `Due ${dueLabel(t.due_date)}`, tone: t.priority === 'urgent' ? 'danger' : 'attention' });
  }

  return items;
}

export async function getExpenses(familyId: string, student?: 'Hamza' | 'Omar'): Promise<Expense[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('expenses')
    .select('id, category, amount, currency, description, spent_on, student:student_profiles(member:family_members!student_profiles_member_id_fkey(display_name)), funding:funding_sources(label)')
    .eq('family_id', familyId)
    .order('spent_on', { ascending: false })
    .limit(50);

  return (data ?? [])
    .map((e) => {
      const name = one<{ member: { display_name: string } | null }>(e.student)?.member?.display_name;
      return {
        id: e.id,
        student: (name === 'Hamza' || name === 'Omar' ? name : 'Hamza') as 'Hamza' | 'Omar',
        category: e.category as ExpenseCategory,
        amount: Number(e.amount),
        currency: e.currency,
        description: e.description ?? '',
        spentOn: dueLabel(e.spent_on),
        fundingLabel: one<{ label: string }>(e.funding)?.label ?? 'Unassigned',
      };
    })
    .filter((e) => !student || e.student === student);
}

export async function getPaymentRequests(familyId: string, student?: 'Hamza' | 'Omar'): Promise<PaymentRequest[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('payment_requests')
    .select('id, amount, currency, reason, category, urgency, status, student:student_profiles(member:family_members!student_profiles_member_id_fkey(display_name)), requested_by:family_members!payment_requests_requested_by_fkey(display_name)')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });

  return (data ?? [])
    .map((r) => {
      const name = one<{ member: { display_name: string } | null }>(r.student)?.member?.display_name;
      return {
        id: r.id,
        student: (name === 'Hamza' || name === 'Omar' ? name : 'Omar') as 'Hamza' | 'Omar',
        amount: Number(r.amount),
        currency: r.currency,
        reason: r.reason,
        category: r.category as ExpenseCategory,
        urgency: r.urgency as TaskPriority,
        requestedBy: one<{ display_name: string }>(r.requested_by)?.display_name ?? '—',
        status: r.status as PaymentRequest['status'],
      };
    })
    .filter((r) => !student || r.student === student);
}
