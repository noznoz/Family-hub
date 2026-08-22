import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { dueLabel } from '@/lib/utils';

function one<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}
function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export interface FundingPeriod { id: string; label: string; status: string; start_date: string; end_date: string | null }
export interface Milestone { id: string; title: string; occurred_on: string | null; occurredDate: string | null; description: string; kind: string }

export interface StudentDetail {
  memberId: string;
  name: string;
  email: string | null;
  phone: string | null;
  university: string;
  universityCity: string | null;
  universityWebsite: string | null;
  course: string | null;
  studentRef: string | null;
  campus: string | null;
  advisor: string | null;
  startDate: string | null;
  expectedGraduation: string | null;
  startDateISO: string | null;
  expectedGraduationISO: string | null;
  years: { label: string; studyYear: number | null; status: string }[];
  funding: FundingPeriod[];
  milestones: Milestone[];
  accommodation: { property: string; address: string; rent: string } | null;
  tasks: { id: string; title: string; status: string; priority: string; due: string | null }[];
  spentTotal: number;
  currency: string;
  openRequests: number;
  documentsCount: number;
  upcomingTrips: { title: string; when: string }[];
}

/** Everything about one student, pulled from across the app. */
export async function getStudentDetail(studentId: string): Promise<StudentDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: sp } = await supabase
    .from('student_profiles')
    .select('id, member_id, course, student_ref, campus, advisor, start_date, expected_graduation, member:family_members!student_profiles_member_id_fkey(display_name, profile_id, invite_email), university:universities(name, city, website), years:academic_years(label, study_year, status)')
    .eq('id', studentId)
    .maybeSingle();
  if (!sp) return null;

  const memberId = (sp as { member_id: string }).member_id;
  const member = one<{ display_name: string; profile_id: string | null; invite_email: string | null }>(sp.member);
  const uni = one<{ name: string; city: string | null; website: string | null }>(sp.university);

  let email = member?.invite_email ?? null;
  let phone: string | null = null;
  if (member?.profile_id) {
    const { data: profile } = await supabase.from('profiles').select('email, phone').eq('id', member.profile_id).maybeSingle();
    if (profile?.email) email = profile.email;
    phone = profile?.phone ?? null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const [fundRes, mileRes, accRes, taskRes, expRes, reqRes, docRes, tripRes] = await Promise.all([
    supabase.from('funding_sources').select('id, label, status, start_date, end_date').eq('student_id', studentId).order('start_date', { ascending: true }),
    supabase.from('student_milestones').select('id, title, occurred_on, description, kind').eq('student_id', studentId).order('occurred_on', { ascending: true }),
    supabase.from('accommodations').select('property, address, monthly_rent, currency, end_date, start_date').eq('student_id', studentId).order('start_date', { ascending: false }),
    supabase.from('tasks').select('id, title, status, priority, due_date').or(`student_id.eq.${studentId},assignee_id.eq.${memberId}`).neq('status', 'done').order('due_date', { ascending: true }).limit(20),
    supabase.from('expenses').select('amount, currency').eq('student_id', studentId).limit(500),
    supabase.from('payment_requests').select('id', { count: 'exact', head: true }).eq('student_id', studentId).eq('status', 'requested'),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('trip_members').select('trip:trips(title, depart_at)').eq('member_id', memberId),
  ]);

  const acc = (accRes.data ?? []).find((a) => (!a.end_date || a.end_date >= today) && (!a.start_date || a.start_date <= today)) ?? (accRes.data ?? [])[0];
  const expenses = expRes.data ?? [];
  const currency = expenses[0]?.currency ?? 'GBP';
  const spentTotal = expenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

  const upcomingTrips = (tripRes.data ?? [])
    .map((t) => one<{ title: string; depart_at: string }>(t.trip))
    .filter((t): t is { title: string; depart_at: string } => !!t?.depart_at && new Date(t.depart_at) > new Date())
    .sort((a, b) => +new Date(a.depart_at) - +new Date(b.depart_at))
    .slice(0, 4)
    .map((t) => ({ title: t.title, when: dueLabel(t.depart_at) }));

  return {
    memberId,
    name: member?.display_name ?? 'Student',
    email,
    phone,
    university: uni?.name ?? '—',
    universityCity: uni?.city ?? null,
    universityWebsite: uni?.website ?? null,
    course: sp.course ?? null,
    studentRef: sp.student_ref ?? null,
    campus: sp.campus ?? null,
    advisor: sp.advisor ?? null,
    startDate: fmtDate(sp.start_date),
    expectedGraduation: fmtDate(sp.expected_graduation),
    startDateISO: (sp.start_date as string | null) ?? null,
    expectedGraduationISO: (sp.expected_graduation as string | null) ?? null,
    years: (((sp.years as { label: string; study_year: number | null; status: string }[]) ?? [])
      .sort((a, b) => (a.study_year ?? 0) - (b.study_year ?? 0))
      .map((y) => ({ label: y.label, studyYear: y.study_year, status: y.status }))),
    funding: (fundRes.data ?? []).map((f) => ({ ...f, start_date: fmtDate(f.start_date) ?? f.start_date, end_date: f.end_date ? fmtDate(f.end_date) : null })) as FundingPeriod[],
    milestones: ((mileRes.data ?? []).map((m) => ({
      id: m.id, title: m.title, occurred_on: fmtDate(m.occurred_on), occurredDate: m.occurred_on ?? null,
      description: (m as { description?: string | null }).description ?? '', kind: (m as { kind?: string }).kind ?? 'other',
    }))) as Milestone[],
    accommodation: acc ? { property: acc.property, address: acc.address ?? '', rent: acc.monthly_rent ? `${acc.currency ?? 'GBP'} ${acc.monthly_rent}/mo` : '—' } : null,
    tasks: (taskRes.data ?? []).map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due: t.due_date ? dueLabel(t.due_date) : null })),
    spentTotal,
    currency,
    openRequests: reqRes.count ?? 0,
    documentsCount: docRes.count ?? 0,
    upcomingTrips,
  };
}

export interface StudentPrivate {
  phone: string | null; address: string | null; emergencyContact: string | null;
  doctorGp: string | null; bloodType: string | null;
  bankName: string | null; accountNumber: string | null; sortCode: string | null; iban: string | null;
  nationalInsurance: string | null; brpNumber: string | null; passportNumber: string | null;
  notes: string | null;
}

/**
 * Sensitive student info. RLS ensures only admins/parents or the student
 * themselves get a row back; everyone else gets null. Also null when the
 * migration hasn't run yet (42P01/42703).
 */
export async function getStudentPrivate(studentId: string): Promise<StudentPrivate | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('student_private')
    .select('phone, address, emergency_contact, doctor_gp, blood_type, bank_name, account_number, sort_code, iban, national_insurance, brp_number, passport_number, notes')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    phone: data.phone, address: data.address, emergencyContact: data.emergency_contact,
    doctorGp: data.doctor_gp, bloodType: data.blood_type,
    bankName: data.bank_name, accountNumber: data.account_number, sortCode: data.sort_code, iban: data.iban,
    nationalInsurance: data.national_insurance, brpNumber: data.brp_number, passportNumber: data.passport_number,
    notes: data.notes,
  };
}

/** Whether the current user may see/edit a student's private info. */
export async function canSeeStudentPrivate(studentId: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase.rpc('can_see_student_private', { sid: studentId });
  return data === true;
}
