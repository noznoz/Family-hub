import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  Member, StudentSummary, Task, AttentionItem, Expense, PaymentRequest,
  TaskPriority, TaskStatus, ExpenseCategory,
} from '@/lib/types';
import type { SystemRole } from '@/lib/permissions';
import { dueLabel } from '@/lib/utils';
import { signMedia, signMediaMany } from '@/lib/signed-urls';


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
    .select('id, display_name, role, is_student, status, invite_email, profile_id, avatar_path, relationships:family_relationships!family_relationships_member_id_fkey(relationship)')
    .eq('family_id', familyId)
    .neq('status', 'disabled')
    .order('created_at', { ascending: true });

  const rows = data ?? [];
  const avatars = await signMediaMany(rows.map((m) => (m as { avatar_path?: string | null }).avatar_path));
  return rows.map((m) => {
    const path = (m as { avatar_path?: string | null }).avatar_path;
    return {
      id: m.id,
      displayName: m.display_name,
      role: m.role as SystemRole,
      isStudent: m.is_student,
      status: m.status,
      inviteEmail: (m as { invite_email?: string | null }).invite_email ?? null,
      linked: !!(m as { profile_id?: string | null }).profile_id,
      avatarUrl: path ? avatars.get(path) ?? null : null,
      relationship:
        (m.relationships as { relationship: string }[] | null)?.[0]?.relationship?.replace(/_/g, ' ') ??
        (m.is_student ? 'Son' : 'Family'),
    };
  });
}

interface StudentRow {
  id: string;
  member_id: string;
  course: string | null;
  overall_status: string | null;
  status: string;
  member: { display_name: string; avatar_path: string | null } | null;
  university: { name: string } | null;
}

export async function getStudents(familyId: string): Promise<StudentSummary[]> {
  try {
    const supabase = await createClient();
    if (!supabase) return [];
    const { data } = await supabase
      .from('student_profiles')
      .select('id, member_id, course, overall_status, status, member:family_members!student_profiles_member_id_fkey(display_name, avatar_path), university:universities(name)')
      .eq('family_id', familyId);

    const rows = (data ?? []) as unknown as StudentRow[];
    return await Promise.all(rows.map((r) => enrichStudent(supabase, r)));
  } catch (e) {
    console.error('[getStudents] failed:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function enrichStudent(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  r: StudentRow,
): Promise<StudentSummary> {
  const name = r.member?.display_name ?? 'Student';

  const [yearRes, fundingRes, taskRes, tripRes, reqRes] = await Promise.all([
    supabase.from('academic_years').select('label, study_year')
      .eq('student_id', r.id).eq('status', 'active').limit(1).maybeSingle(),
    supabase.from('funding_sources').select('label, kind')
      .eq('student_id', r.id).eq('status', 'active').order('start_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('tasks').select('title, due_date')
      .eq('student_id', r.id).neq('status', 'done').order('due_date', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('trip_members').select('trip:trips(title, depart_at)')
      .eq('member_id', r.member_id).limit(5),
    supabase.from('payment_requests').select('reason, amount, currency, created_at')
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
    avatarUrl: await signMedia(r.member?.avatar_path),
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

  // Base rows with NO embeds — as reliable as any plain select (a bad embed
  // would 400 the whole query and blank the list, which is what bit us before).
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, priority, status, due_date, assignee_id, student_id, parent_task_id, attachment_url')
    .eq('family_id', familyId)
    .order('due_date', { ascending: true });
  if (error) console.error('[getTasks]', error.code, error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Resolve names & links via plain, embed-free lookups (each fail-safe).
  const memberName = new Map<string, string>();          // member id -> display name
  const studentDisplay = new Map<string, string>();      // student_profile id -> member name
  const recurByTask = new Map<string, string>();         // task id -> frequency
  const assigneeByTask = new Map<string, { id: string; name: string }[]>();
  const studentByTask = new Map<string, { id: string; name: string }[]>();
  try {
    const [memRes, spRes, recRes, taRes, tsRes] = await Promise.all([
      supabase.from('family_members').select('id, display_name').eq('family_id', familyId),
      supabase.from('student_profiles').select('id, member_id').eq('family_id', familyId),
      supabase.from('task_recurrences').select('task_id, frequency').eq('active', true),
      supabase.from('task_assignees').select('task_id, member_id'),
      supabase.from('task_students').select('task_id, student_id'),
    ]);
    for (const m of memRes.data ?? []) memberName.set(m.id, m.display_name);
    for (const sp of spRes.data ?? []) {
      const nm = memberName.get((sp as { member_id: string }).member_id);
      if (nm) studentDisplay.set(sp.id, nm);
    }
    for (const r of recRes.data ?? []) recurByTask.set(r.task_id, r.frequency);
    for (const r of taRes.data ?? []) {
      const nm = memberName.get(r.member_id);
      if (nm) assigneeByTask.set(r.task_id, [...(assigneeByTask.get(r.task_id) ?? []), { id: r.member_id, name: nm }]);
    }
    for (const r of tsRes.data ?? []) {
      const nm = studentDisplay.get(r.student_id);
      if (nm) studentByTask.set(r.task_id, [...(studentByTask.get(r.task_id) ?? []), { id: r.student_id, name: nm }]);
    }
  } catch (e) {
    console.error('[getTasks] lookups failed', e instanceof Error ? e.message : String(e));
  }

  // Group subtasks under their parent.
  const subById = new Map<string, { id: string; title: string; status: TaskStatus }[]>();
  for (const t of rows) {
    const pid = (t as { parent_task_id?: string | null }).parent_task_id;
    if (pid) subById.set(pid, [...(subById.get(pid) ?? []), { id: t.id, title: t.title, status: t.status as TaskStatus }]);
  }

  const parents = rows.filter((t) => !(t as { parent_task_id?: string | null }).parent_task_id);
  // Sign attachments best-effort — a signing failure must not drop the task.
  const attachments = await signMediaMany(parents.map((t) => (t as { attachment_url?: string | null }).attachment_url));

  return parents.map((t) => {
    const attachmentPath = (t as { attachment_url?: string | null }).attachment_url ?? null;
    const aId = (t as { assignee_id?: string | null }).assignee_id ?? null;
    const sId = (t as { student_id?: string | null }).student_id ?? null;
    const asg = assigneeByTask.get(t.id)
      ?? (aId && memberName.get(aId) ? [{ id: aId, name: memberName.get(aId)! }] : []);
    const std = studentByTask.get(t.id)
      ?? (sId && studentDisplay.get(sId) ? [{ id: sId, name: studentDisplay.get(sId)! }] : []);
    const assignees = asg.map((m) => m.name);
    const assigneeIds = asg.map((m) => m.id);
    const students = std.map((s) => s.name);
    const studentIds = std.map((s) => s.id);
    const primaryStudent = (sId ? studentDisplay.get(sId) : undefined) ?? students[0];
    return {
      id: t.id,
      title: t.title,
      description: t.description ?? undefined,
      assignee: (aId ? memberName.get(aId) : undefined) ?? assignees[0] ?? undefined,
      assignees,
      student: (primaryStudent === 'Hamza' || primaryStudent === 'Omar' ? primaryStudent : null) as Task['student'],
      students,
      due: t.due_date ? dueLabel(t.due_date) : null,
      priority: t.priority as TaskPriority,
      status: t.status as TaskStatus,
      dueDate: t.due_date ?? null,
      studentId: sId ?? studentIds[0] ?? null,
      studentIds,
      assigneeId: aId ?? assigneeIds[0] ?? null,
      assigneeIds,
      repeat: recurByTask.get(t.id) ?? 'none',
      attachmentUrl: attachmentPath ? attachments.get(attachmentPath) ?? null : null,
      subtasks: subById.get(t.id) ?? [],
    };
  });
}

export interface HomeSummary {
  nextTrip: { title: string; iso: string } | null;
  openTasks: number;
  docsExpiring: number;
  openRequests: number;
}

/** At-a-glance counts + nearest upcoming trip for the Home dashboard. */
export async function getHomeSummary(familyId: string): Promise<HomeSummary> {
  const empty: HomeSummary = { nextTrip: null, openTasks: 0, docsExpiring: 0, openRequests: 0 };
  const supabase = await createClient();
  if (!supabase) return empty;
  const now = new Date().toISOString();
  const soon90 = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  try {
    const [tripRes, taskRes, docRes, reqRes] = await Promise.all([
      supabase.from('trips').select('title, depart_at').eq('family_id', familyId).gt('depart_at', now).order('depart_at', { ascending: true }).limit(1),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('family_id', familyId).neq('status', 'done').is('parent_task_id', null),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('family_id', familyId).not('expiry_date', 'is', null).lte('expiry_date', soon90),
      supabase.from('payment_requests').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('status', 'requested'),
    ]);
    const trip = tripRes.data?.[0];
    return {
      nextTrip: trip?.depart_at ? { title: trip.title, iso: trip.depart_at } : null,
      openTasks: taskRes.count ?? 0,
      docsExpiring: docRes.count ?? 0,
      openRequests: reqRes.count ?? 0,
    };
  } catch (e) {
    console.error('[getHomeSummary]', e instanceof Error ? e.message : String(e));
    return empty;
  }
}

export async function getAttention(familyId: string): Promise<AttentionItem[]> {
  try {
    return await getAttentionInner(familyId);
  } catch (e) {
    console.error('[getAttention] failed:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function getAttentionInner(familyId: string): Promise<AttentionItem[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const items: AttentionItem[] = [];

  const { data: reqs } = await supabase
    .from('payment_requests')
    .select('id, amount, currency, reason, requested_by:family_members!payment_requests_requested_by_fkey(display_name)')
    .eq('family_id', familyId).eq('status', 'requested').limit(3);
  for (const r of reqs ?? []) {
    const who = one<{ display_name: string }>(r.requested_by)?.display_name ?? 'Someone';
    items.push({ id: `req-${r.id}`, title: 'New payment request', detail: `${who} requested ${r.currency} ${r.amount} — ${r.reason}`, tone: 'brand', href: '/money' });
  }

  const soon = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const { data: docs } = await supabase
    .from('documents')
    .select('id, name, expiry_date')
    .eq('family_id', familyId).not('expiry_date', 'is', null).lte('expiry_date', soon).limit(3);
  for (const d of docs ?? []) {
    items.push({ id: `doc-${d.id}`, title: `${d.name} expiring`, detail: `Expires ${d.expiry_date}`, tone: 'attention', href: '/documents' });
  }

  const dueSoon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, priority')
    .eq('family_id', familyId).neq('status', 'done').not('due_date', 'is', null).lte('due_date', dueSoon).limit(4);
  for (const t of tasks ?? []) {
    items.push({ id: `task-${t.id}`, title: t.title, detail: `Due ${dueLabel(t.due_date)}`, tone: t.priority === 'urgent' ? 'danger' : 'attention', href: '/tasks' });
  }

  return items;
}

export async function getExpenses(familyId: string, student?: 'Hamza' | 'Omar'): Promise<Expense[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('expenses')
    .select('id, category, amount, currency, description, spent_on, student_id, receipt_path, student:student_profiles(member:family_members!student_profiles_member_id_fkey(display_name)), funding:funding_sources(label)')
    .eq('family_id', familyId)
    .order('spent_on', { ascending: false })
    .limit(50);

  const expenseRows = data ?? [];
  const receipts = await signMediaMany(expenseRows.map((e) => (e as { receipt_path?: string | null }).receipt_path));
  const mapped = expenseRows.map((e) => {
    const name = one<{ member: { display_name: string } | null }>(e.student)?.member?.display_name;
    const receiptPath = (e as { receipt_path?: string | null }).receipt_path ?? null;
    return {
      id: e.id,
      student: (name === 'Hamza' || name === 'Omar' ? name : 'Hamza') as 'Hamza' | 'Omar',
      category: e.category as ExpenseCategory,
      amount: Number(e.amount),
      currency: e.currency,
      description: e.description ?? '',
      spentOn: dueLabel(e.spent_on),
      fundingLabel: one<{ label: string }>(e.funding)?.label ?? 'Unassigned',
      studentId: (e as { student_id?: string | null }).student_id ?? null,
      spentOnDate: e.spent_on ?? null,
      receiptUrl: receiptPath ? receipts.get(receiptPath) ?? null : null,
    };
  });
  return mapped.filter((e) => !student || e.student === student);
}

export interface BudgetSnapshot { studentId: string; name: string; budget: number; spent: number; currency: string }

/** Current-month budget vs actual spend, per student. */
export async function getBudgets(familyId: string): Promise<BudgetSnapshot[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthIso = monthStart.toISOString().slice(0, 10);

  const [studentsRes, budgetsRes, expensesRes] = await Promise.all([
    supabase.from('student_profiles').select('id, member:family_members!student_profiles_member_id_fkey(display_name)').eq('family_id', familyId),
    supabase.from('budgets').select('student_id, amount, currency').eq('family_id', familyId).eq('month', monthIso),
    supabase.from('expenses').select('student_id, amount, currency').eq('family_id', familyId).gte('spent_on', monthIso),
  ]);

  const budgetByStudent = new Map<string, { amount: number; currency: string }>();
  for (const b of budgetsRes.data ?? []) budgetByStudent.set(b.student_id, { amount: Number(b.amount), currency: b.currency });
  const spentByStudent = new Map<string, number>();
  let anyCurrency = 'GBP';
  for (const e of expensesRes.data ?? []) {
    if (!e.student_id) continue;
    spentByStudent.set(e.student_id, (spentByStudent.get(e.student_id) ?? 0) + Number(e.amount ?? 0));
    anyCurrency = e.currency ?? anyCurrency;
  }

  return (studentsRes.data ?? []).map((s) => {
    const b = budgetByStudent.get(s.id);
    return {
      studentId: s.id,
      name: one<{ display_name: string }>(s.member)?.display_name ?? 'Student',
      budget: b?.amount ?? 0,
      spent: spentByStudent.get(s.id) ?? 0,
      currency: b?.currency ?? anyCurrency,
    };
  });
}

export async function getPaymentRequests(familyId: string, student?: 'Hamza' | 'Omar'): Promise<PaymentRequest[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('payment_requests')
    .select('id, amount, currency, reason, category, urgency, status, note, student_id, student:student_profiles(member:family_members!student_profiles_member_id_fkey(display_name)), requested_by:family_members!payment_requests_requested_by_fkey(display_name)')
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
        studentId: (r as { student_id?: string | null }).student_id ?? null,
        note: (r as { note?: string | null }).note ?? null,
      };
    })
    .filter((r) => !student || r.student === student);
}
