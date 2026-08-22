import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { dueLabel } from '@/lib/utils';

async function signMedia(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.storage.from(env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

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
export interface FlightView {
  id: string; airline: string; flightNumber: string; bookingRef: string;
  departAirport: string; arriveAirport: string; departAt: string; arriveAt: string;
  terminal: string; seat: string; baggage: string;
}
export interface TripView {
  id: string; title: string; origin: string; destination: string;
  departLabel: string; departRaw: string | null; travelers: string[]; upcoming: boolean;
  destAddress: string; notes: string; memberIds: string[]; flights: FlightView[];
}
export async function getTrips(familyId: string): Promise<TripView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('trips')
    .select('id, title, origin, destination, depart_at, dest_address, notes, members:trip_members(member:family_members!trip_members_member_id_fkey(id, display_name)), flights:flights(id, airline, flight_number, booking_ref, depart_airport, arrive_airport, depart_at, arrive_at, terminal, seat, baggage)')
    .eq('family_id', familyId)
    .order('depart_at', { ascending: true });
  const now = Date.now();
  return (data ?? []).map((t) => {
    const members = ((t.members as unknown as { member: unknown }[] | null) ?? [])
      .map((m) => one<{ id: string; display_name: string }>(m.member))
      .filter((m): m is { id: string; display_name: string } => !!m);
    return {
      id: t.id,
      title: t.title,
      origin: t.origin ?? '',
      destination: t.destination ?? '',
      departLabel: t.depart_at ? dueLabel(t.depart_at) : 'No date',
      departRaw: t.depart_at,
      travelers: members.map((m) => m.display_name),
      memberIds: members.map((m) => m.id),
      destAddress: (t as { dest_address?: string | null }).dest_address ?? '',
      notes: (t as { notes?: string | null }).notes ?? '',
      upcoming: t.depart_at ? new Date(t.depart_at).getTime() > now : false,
      flights: (((t as { flights?: Record<string, unknown>[] }).flights) ?? []).map((f) => ({
        id: String(f.id),
        airline: (f.airline as string) ?? '',
        flightNumber: (f.flight_number as string) ?? '',
        bookingRef: (f.booking_ref as string) ?? '',
        departAirport: (f.depart_airport as string) ?? '',
        arriveAirport: (f.arrive_airport as string) ?? '',
        departAt: f.depart_at ? fmtDateTime(f.depart_at as string) : '',
        arriveAt: f.arrive_at ? fmtDateTime(f.arrive_at as string) : '',
        terminal: (f.terminal as string) ?? '',
        seat: (f.seat as string) ?? '',
        baggage: (f.baggage as string) ?? '',
      })),
    };
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Accommodation ───────────────────────────────────────────────────────────
export interface AccommodationView {
  id: string; property: string; address: string; landlord: string;
  start: string; end: string; rent: string; student: string; current: boolean;
  studentId: string | null; contact: string; startDate: string | null; endDate: string | null;
  rentAmount: number | null; deposit: number | null; currency: string;
  wifiInfo: string; utilityNotes: string; maintenanceNotes: string;
  contractUrl: string | null; photos: { id: string; url: string | null }[];
}
export async function getAccommodations(familyId: string): Promise<AccommodationView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('accommodations')
    .select('id, property, address, landlord, contact, start_date, end_date, monthly_rent, deposit, currency, student_id, wifi_info, utility_notes, maintenance_notes, contract_path, student:student_profiles(member:family_members!student_profiles_member_id_fkey(display_name)), photos:accommodation_photos(id, storage_path)')
    .eq('family_id', familyId)
    .order('start_date', { ascending: false });
  const today = new Date().toISOString().slice(0, 10);
  return Promise.all((data ?? []).map(async (a) => ({
    id: a.id,
    property: a.property,
    address: a.address ?? '',
    landlord: a.landlord ?? '',
    start: fmtDate(a.start_date),
    end: fmtDate(a.end_date),
    rent: a.monthly_rent ? `${a.currency ?? 'GBP'} ${a.monthly_rent}/mo` : '—',
    student: one<{ member: { display_name: string } | null }>(a.student)?.member?.display_name ?? '',
    current: (!a.end_date || a.end_date >= today) && (!a.start_date || a.start_date <= today),
    studentId: (a as { student_id?: string | null }).student_id ?? null,
    contact: (a as { contact?: string | null }).contact ?? '',
    startDate: a.start_date ?? null,
    endDate: a.end_date ?? null,
    rentAmount: a.monthly_rent != null ? Number(a.monthly_rent) : null,
    deposit: (a as { deposit?: number | null }).deposit != null ? Number((a as { deposit?: number | null }).deposit) : null,
    currency: a.currency ?? 'GBP',
    wifiInfo: (a as { wifi_info?: string | null }).wifi_info ?? '',
    utilityNotes: (a as { utility_notes?: string | null }).utility_notes ?? '',
    maintenanceNotes: (a as { maintenance_notes?: string | null }).maintenance_notes ?? '',
    contractUrl: await signMedia((a as { contract_path?: string | null }).contract_path),
    photos: await Promise.all((((a as { photos?: { id: string; storage_path: string }[] }).photos) ?? []).map(async (p) => ({ id: p.id, url: await signMedia(p.storage_path) }))),
  })));
}

// ── University ────────────────────────────────────────────────────────────
export interface UniversityView {
  studentId: string; name: string; university: string; course: string; ref: string;
  years: { id: string; label: string; studyYear: number | null; status: string; terms: { id: string; name: string; when: string }[] }[];
}
export async function getUniversityInfo(familyId: string): Promise<UniversityView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('student_profiles')
    .select('id, course, student_ref, member:family_members!student_profiles_member_id_fkey(display_name), university:universities(name), years:academic_years(id, label, study_year, status, terms:academic_terms(id, name, start_date, end_date))')
    .eq('family_id', familyId);
  return (data ?? []).map((s) => ({
    studentId: s.id,
    name: one<{ display_name: string }>(s.member)?.display_name ?? 'Student',
    university: one<{ name: string }>(s.university)?.name ?? '—',
    course: s.course ?? '—',
    ref: s.student_ref ?? '—',
    years: (((s.years as { id: string; label: string; study_year: number | null; status: string; terms?: { id: string; name: string; start_date: string | null; end_date: string | null }[] }[]) ?? [])
      .sort((a, b) => (a.study_year ?? 0) - (b.study_year ?? 0))
      .map((y) => ({
        id: y.id, label: y.label, studyYear: y.study_year, status: y.status,
        terms: (y.terms ?? []).map((t) => ({
          id: t.id, name: t.name,
          when: [t.start_date ? fmtDate(t.start_date) : null, t.end_date ? fmtDate(t.end_date) : null].filter(Boolean).join(' → '),
        })),
      }))),
  }));
}

// ── Scholarship ─────────────────────────────────────────────────────────────
export interface ScholarshipView {
  studentId: string; scholarshipId: string | null; name: string; sponsor: string; stage: string;
  requirements: { id: string; title: string; kind: string; dueDate: string | null; due: string; done: boolean }[];
  funding: { id: string; label: string; kind: string; sponsor: string; status: string; startDate: string | null; endDate: string | null; start: string; end: string }[];
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
      supabase.from('scholarships').select('id, sponsor, stage, requirements:scholarship_requirements(id, title, kind, due_date, completed)').eq('student_id', s.id).order('start_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('funding_sources').select('id, label, kind, sponsor, status, start_date, end_date').eq('student_id', s.id).order('start_date', { ascending: true }),
    ]);
    const sch = schRes.data as { id: string; sponsor: string | null; stage: string; requirements: { id: string; title: string; kind: string | null; due_date: string | null; completed: boolean }[] } | null;
    out.push({
      studentId: s.id,
      scholarshipId: sch?.id ?? null,
      name: one<{ display_name: string }>(s.member)?.display_name ?? 'Student',
      sponsor: sch?.sponsor ?? '',
      stage: sch?.stage ?? 'family_funded',
      requirements: (sch?.requirements ?? []).map((r) => ({ id: r.id, title: r.title, kind: r.kind ?? '', dueDate: r.due_date, due: fmtDate(r.due_date), done: r.completed })),
      funding: ((fundRes.data as { id: string; label: string; kind: string; sponsor: string | null; status: string; start_date: string; end_date: string | null }[]) ?? []).map((f) => ({ id: f.id, label: f.label, kind: f.kind, sponsor: f.sponsor ?? '', status: f.status, startDate: f.start_date, endDate: f.end_date, start: fmtDate(f.start_date), end: f.end_date ? fmtDate(f.end_date) : 'present' })),
    });
  }
  return out;
}

// ── Calendar ────────────────────────────────────────────────────────────────
export interface CalEvent {
  id: string; title: string; kind: string; when: string; whenRaw: string; student: string | null;
  studentId: string | null; startsAtInput: string; derived?: boolean;
}
export async function getCalendar(familyId: string): Promise<CalEvent[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const horizon = new Date(Date.now() + 200 * 86_400_000).toISOString();

  const [evRes, docRes, tripRes, accRes] = await Promise.all([
    supabase.from('calendar_events')
      .select('id, title, kind, starts_at, student_id, student:student_profiles(member:family_members!student_profiles_member_id_fkey(display_name))')
      .eq('family_id', familyId).gte('starts_at', since).order('starts_at', { ascending: true }).limit(80),
    supabase.from('documents').select('id, name, expiry_date').eq('family_id', familyId).not('expiry_date', 'is', null).gte('expiry_date', since.slice(0, 10)).limit(50),
    supabase.from('trips').select('id, title, depart_at').eq('family_id', familyId).not('depart_at', 'is', null).gte('depart_at', since).lte('depart_at', horizon).limit(50),
    supabase.from('accommodations').select('id, property, payment_date, end_date, currency, monthly_rent').eq('family_id', familyId).not('payment_date', 'is', null).limit(20),
  ]);

  const events: CalEvent[] = (evRes.data ?? []).map((e) => ({
    id: e.id, title: e.title, kind: e.kind, when: dueLabel(e.starts_at), whenRaw: fmtDate(e.starts_at),
    student: one<{ member: { display_name: string } | null }>(e.student)?.member?.display_name ?? null,
    studentId: (e as { student_id?: string | null }).student_id ?? null,
    startsAtInput: e.starts_at ? toLocalInput(e.starts_at) : '',
  }));

  const derive = (id: string, title: string, kind: string, iso: string): CalEvent => ({
    id, title, kind, when: dueLabel(iso), whenRaw: fmtDate(iso), student: null, studentId: null,
    startsAtInput: toLocalInput(iso), derived: true,
  });

  for (const d of docRes.data ?? []) {
    if (d.expiry_date) events.push(derive(`doc-${d.id}`, `${d.name} expires`, 'doc_expiry', `${d.expiry_date}T09:00:00`));
  }
  for (const t of tripRes.data ?? []) {
    if (t.depart_at) events.push(derive(`trip-${t.id}`, `Trip: ${t.title}`, 'flight', t.depart_at));
  }
  // Next rent due date for each current accommodation with a payment day.
  const today = new Date();
  for (const a of accRes.data ?? []) {
    const day = a.payment_date as number | null;
    if (!day) continue;
    if (a.end_date && a.end_date < today.toISOString().slice(0, 10)) continue;
    const due = new Date(today.getFullYear(), today.getMonth(), day);
    if (due < today) due.setMonth(due.getMonth() + 1);
    const rentLabel = a.monthly_rent ? ` (${a.currency ?? 'GBP'} ${a.monthly_rent})` : '';
    events.push(derive(`rent-${a.id}`, `Rent due — ${a.property}${rentLabel}`, 'rent', `${due.toISOString().slice(0, 10)}T09:00:00`));
  }

  return events.sort((x, y) => (x.startsAtInput < y.startsAtInput ? -1 : 1));
}

/** ISO timestamp → value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Reminders ────────────────────────────────────────────────────────────────
export interface UpcomingReminder {
  id: string; title: string; when: string; link: string;
  recipients: string[]; mine: boolean;
}
export async function getUpcomingReminders(familyId: string, memberId: string): Promise<UpcomingReminder[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('reminders')
    .select('id, title, link, remind_at, recipient_ids, created_by')
    .eq('family_id', familyId)
    .eq('status', 'pending')
    .order('remind_at', { ascending: true })
    .limit(50);

  const rows = (data ?? []).filter((r) => {
    const rec = (r.recipient_ids as string[] | null) ?? [];
    return r.created_by === memberId || rec.includes(memberId);
  });
  if (rows.length === 0) return [];

  // Resolve recipient names for display.
  const ids = [...new Set(rows.flatMap((r) => ((r.recipient_ids as string[] | null) ?? [])))];
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: members } = await supabase.from('family_members').select('id, display_name').in('id', ids);
    for (const m of members ?? []) nameById.set(m.id, m.display_name);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    link: r.link ?? '/home',
    when: new Date(r.remind_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    recipients: ((r.recipient_ids as string[] | null) ?? []).map((id) => nameById.get(id) ?? '').filter(Boolean),
    mine: r.created_by === memberId,
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
