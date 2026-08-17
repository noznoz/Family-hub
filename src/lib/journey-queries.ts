import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { dueLabel } from '@/lib/utils';

function one<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}
function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Travel ────────────────────────────────────────────────────────────────
export interface TripView {
  id: string; title: string; origin: string; destination: string;
  departLabel: string; departRaw: string | null; travelers: string[]; upcoming: boolean;
}
export async function getTrips(familyId: string): Promise<TripView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('trips')
    .select('id, title, origin, destination, depart_at, members:trip_members(member:family_members!trip_members_member_id_fkey(display_name))')
    .eq('family_id', familyId)
    .order('depart_at', { ascending: true });
  const now = Date.now();
  return (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    origin: t.origin ?? '',
    destination: t.destination ?? '',
    departLabel: t.depart_at ? dueLabel(t.depart_at) : 'No date',
    departRaw: t.depart_at,
    travelers: ((t.members as unknown as { member: unknown }[] | null) ?? [])
      .map((m) => one<{ display_name: string }>(m.member)?.display_name ?? '')
      .filter(Boolean),
    upcoming: t.depart_at ? new Date(t.depart_at).getTime() > now : false,
  }));
}

// ── Accommodation ───────────────────────────────────────────────────────────
export interface AccommodationView {
  id: string; property: string; address: string; landlord: string;
  start: string; end: string; rent: string; student: string; current: boolean;
}
export async function getAccommodations(familyId: string): Promise<AccommodationView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('accommodations')
    .select('id, property, address, landlord, start_date, end_date, monthly_rent, currency, student:student_profiles(member:family_members!student_profiles_member_id_fkey(display_name))')
    .eq('family_id', familyId)
    .order('start_date', { ascending: false });
  const today = new Date().toISOString().slice(0, 10);
  return (data ?? []).map((a) => ({
    id: a.id,
    property: a.property,
    address: a.address ?? '',
    landlord: a.landlord ?? '',
    start: fmtDate(a.start_date),
    end: fmtDate(a.end_date),
    rent: a.monthly_rent ? `${a.currency ?? 'GBP'} ${a.monthly_rent}/mo` : '—',
    student: one<{ member: { display_name: string } | null }>(a.student)?.member?.display_name ?? '',
    current: (!a.end_date || a.end_date >= today) && (!a.start_date || a.start_date <= today),
  }));
}

// ── University ────────────────────────────────────────────────────────────
export interface UniversityView {
  studentId: string; name: string; university: string; course: string; ref: string;
  years: { label: string; studyYear: number | null; status: string }[];
}
export async function getUniversityInfo(familyId: string): Promise<UniversityView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('student_profiles')
    .select('id, course, student_ref, member:family_members!student_profiles_member_id_fkey(display_name), university:universities(name), years:academic_years(label, study_year, status)')
    .eq('family_id', familyId);
  return (data ?? []).map((s) => ({
    studentId: s.id,
    name: one<{ display_name: string }>(s.member)?.display_name ?? 'Student',
    university: one<{ name: string }>(s.university)?.name ?? '—',
    course: s.course ?? '—',
    ref: s.student_ref ?? '—',
    years: (((s.years as { label: string; study_year: number | null; status: string }[]) ?? [])
      .sort((a, b) => (a.study_year ?? 0) - (b.study_year ?? 0))
      .map((y) => ({ label: y.label, studyYear: y.study_year, status: y.status }))),
  }));
}

// ── Scholarship ─────────────────────────────────────────────────────────────
export interface ScholarshipView {
  studentId: string; name: string; sponsor: string; stage: string;
  requirements: { title: string; kind: string; due: string; done: boolean }[];
  funding: { label: string; status: string; start: string; end: string }[];
}
export async function getScholarshipInfo(familyId: string): Promise<ScholarshipView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data: students } = await supabase
    .from('student_profiles')
    .select('id, member:family_members!student_profiles_member_id_fkey(display_name)')
    .eq('family_id', familyId);

  const out: ScholarshipView[] = [];
  for (const s of students ?? []) {
    const [schRes, fundRes] = await Promise.all([
      supabase.from('scholarships').select('sponsor, stage, requirements:scholarship_requirements(title, kind, due_date, completed)').eq('student_id', s.id).order('start_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('funding_sources').select('label, status, start_date, end_date').eq('student_id', s.id).order('start_date', { ascending: true }),
    ]);
    const sch = schRes.data as { sponsor: string | null; stage: string; requirements: { title: string; kind: string | null; due_date: string | null; completed: boolean }[] } | null;
    out.push({
      studentId: s.id,
      name: one<{ display_name: string }>(s.member)?.display_name ?? 'Student',
      sponsor: sch?.sponsor ?? '—',
      stage: sch?.stage ?? 'family_funded',
      requirements: (sch?.requirements ?? []).map((r) => ({ title: r.title, kind: r.kind ?? '', due: fmtDate(r.due_date), done: r.completed })),
      funding: ((fundRes.data as { label: string; status: string; start_date: string; end_date: string | null }[]) ?? []).map((f) => ({ label: f.label, status: f.status, start: fmtDate(f.start_date), end: f.end_date ? fmtDate(f.end_date) : 'present' })),
    });
  }
  return out;
}

// ── Calendar ────────────────────────────────────────────────────────────────
export interface CalEvent { id: string; title: string; kind: string; when: string; whenRaw: string; student: string | null }
export async function getCalendar(familyId: string): Promise<CalEvent[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('calendar_events')
    .select('id, title, kind, starts_at, student:student_profiles(member:family_members!student_profiles_member_id_fkey(display_name))')
    .eq('family_id', familyId)
    .gte('starts_at', new Date(Date.now() - 86_400_000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(50);
  return (data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    kind: e.kind,
    when: dueLabel(e.starts_at),
    whenRaw: fmtDate(e.starts_at),
    student: one<{ member: { display_name: string } | null }>(e.student)?.member?.display_name ?? null,
  }));
}

// ── Notifications ────────────────────────────────────────────────────────────
export interface NotificationView { id: string; kind: string; title: string; body: string; when: string; unread: boolean }
export async function getNotifications(memberId: string): Promise<NotificationView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('notifications')
    .select('id, kind, title, body, read_at, created_at')
    .eq('recipient_id', memberId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body ?? '',
    when: new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    unread: !n.read_at,
  }));
}
