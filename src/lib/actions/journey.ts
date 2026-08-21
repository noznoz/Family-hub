'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import { can, type Permission } from '@/lib/permissions';
import type { SystemRole } from '@/lib/permissions';

type Result = { ok: true; id?: string } | { ok: false; error: string };

/** Shared context + a permission gate. `perm` accepts a permission key or the
 *  sentinel 'admin_parent' meaning "admins and parents only". */
async function guard(perm: Permission | 'admin_parent') {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: 'Not signed in.' };
  const role: SystemRole = session.member.role;
  const allowed = perm === 'admin_parent' ? role === 'admin' || role === 'parent' : can(role, perm);
  if (!allowed) return { ok: false as const, error: 'You don’t have permission for this.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, error: 'Backend unavailable.' };
  const { data: { user } } = await supabase.auth.getUser();
  return { ok: true as const, session, supabase, userId: user?.id ?? null };
}

// ── Travel / trips ───────────────────────────────────────────────────────────
export interface TripInput {
  title: string;
  origin?: string;
  destination?: string;
  departAt?: string | null;
  destAddress?: string;
  notes?: string;
  memberIds?: string[];
}

async function setTripMembers(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  tripId: string,
  memberIds: string[],
) {
  await supabase.from('trip_members').delete().eq('trip_id', tripId);
  if (memberIds.length) {
    await supabase.from('trip_members').insert(memberIds.map((member_id) => ({ trip_id: tripId, member_id })));
  }
}

export async function createTrip(input: TripInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { data, error } = await g.supabase.from('trips').insert({
    family_id: g.session.familyId,
    title: input.title.trim(),
    origin: input.origin || null,
    destination: input.destination || null,
    depart_at: input.departAt || null,
    dest_address: input.destAddress || null,
    notes: input.notes || null,
    created_by: g.userId,
  }).select('id').single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to save trip.' };
  if (input.memberIds) await setTripMembers(g.supabase, data.id, input.memberIds);
  revalidatePath('/travel');
  return { ok: true, id: data.id };
}

export async function updateTrip(input: TripInput & { id: string }): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('trips').update({
    title: input.title.trim(),
    origin: input.origin || null,
    destination: input.destination || null,
    depart_at: input.departAt || null,
    dest_address: input.destAddress || null,
    notes: input.notes || null,
  }).eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  if (input.memberIds) await setTripMembers(g.supabase, input.id, input.memberIds);
  revalidatePath('/travel');
  return { ok: true };
}

export async function deleteTrip(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('trips').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/travel');
  return { ok: true };
}

// ── Accommodation ─────────────────────────────────────────────────────────────
export interface AccommodationInput {
  property: string;
  studentId?: string | null;
  address?: string;
  landlord?: string;
  contact?: string;
  startDate?: string | null;
  endDate?: string | null;
  monthlyRent?: number | null;
  deposit?: number | null;
  currency?: string;
  wifiInfo?: string;
  utilityNotes?: string;
  maintenanceNotes?: string;
  contractPath?: string | null;
}

function accomFields(input: AccommodationInput) {
  return {
    student_id: input.studentId || null,
    property: input.property.trim(),
    address: input.address || null,
    landlord: input.landlord || null,
    contact: input.contact || null,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    monthly_rent: input.monthlyRent ?? null,
    deposit: input.deposit ?? null,
    currency: input.currency || 'GBP',
    wifi_info: input.wifiInfo || null,
    utility_notes: input.utilityNotes || null,
    maintenance_notes: input.maintenanceNotes || null,
    ...(input.contractPath !== undefined ? { contract_path: input.contractPath } : {}),
  };
}

export async function createAccommodation(input: AccommodationInput): Promise<Result> {
  if (!input.property.trim()) return { ok: false, error: 'Property name is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('accommodations').insert({ family_id: g.session.familyId, ...accomFields(input) });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/accommodation');
  return { ok: true };
}

export async function updateAccommodation(input: AccommodationInput & { id: string }): Promise<Result> {
  if (!input.property.trim()) return { ok: false, error: 'Property name is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('accommodations').update(accomFields(input)).eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/accommodation');
  return { ok: true };
}

export async function deleteAccommodation(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('accommodations').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/accommodation');
  return { ok: true };
}

export async function addAccommodationPhoto(accommodationId: string, storagePath: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('accommodation_photos').insert({ accommodation_id: accommodationId, storage_path: storagePath });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/accommodation');
  return { ok: true };
}

export async function deleteAccommodationPhoto(photoId: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('accommodation_photos').delete().eq('id', photoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/accommodation');
  return { ok: true };
}

// ── Flights (belong to a trip) ────────────────────────────────────────────────
export interface FlightInput {
  tripId: string;
  airline?: string;
  flightNumber?: string;
  bookingRef?: string;
  departAirport?: string;
  arriveAirport?: string;
  departAt?: string | null;
  arriveAt?: string | null;
  terminal?: string;
  seat?: string;
  baggage?: string;
}

export async function addFlight(input: FlightInput): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('flights').insert({
    trip_id: input.tripId,
    airline: input.airline || null,
    flight_number: input.flightNumber || null,
    booking_ref: input.bookingRef || null,
    depart_airport: input.departAirport || null,
    arrive_airport: input.arriveAirport || null,
    depart_at: input.departAt || null,
    arrive_at: input.arriveAt || null,
    terminal: input.terminal || null,
    seat: input.seat || null,
    baggage: input.baggage || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/travel');
  return { ok: true };
}

export async function deleteFlight(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('flights').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/travel');
  return { ok: true };
}

// ── Calendar events ───────────────────────────────────────────────────────────
export interface CalendarInput {
  title: string;
  kind: string;
  startsAt: string;
  studentId?: string | null;
}

export async function createCalendarEvent(input: CalendarInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!input.startsAt) return { ok: false, error: 'Pick a date.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('calendar_events').insert({
    family_id: g.session.familyId,
    student_id: input.studentId || null,
    title: input.title.trim(),
    kind: input.kind || 'general',
    starts_at: new Date(input.startsAt).toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/calendar');
  return { ok: true };
}

export async function updateCalendarEvent(input: CalendarInput & { id: string }): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!input.startsAt) return { ok: false, error: 'Pick a date.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('calendar_events').update({
    student_id: input.studentId || null,
    title: input.title.trim(),
    kind: input.kind || 'general',
    starts_at: new Date(input.startsAt).toISOString(),
  }).eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/calendar');
  return { ok: true };
}

export async function deleteCalendarEvent(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('calendar_events').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/calendar');
  return { ok: true };
}

// ── University: student academics + academic years ────────────────────────────
export interface StudentAcademicsInput {
  studentId: string;
  course?: string;
  studentRef?: string;
  universityName?: string;
}

export async function updateStudentAcademics(input: StudentAcademicsInput): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;

  let universityId: string | undefined;
  const name = input.universityName?.trim();
  if (name) {
    const { data: existing } = await g.supabase
      .from('universities').select('id').eq('family_id', g.session.familyId).ilike('name', name).maybeSingle();
    if (existing) universityId = existing.id;
    else {
      const { data: created } = await g.supabase
        .from('universities').insert({ family_id: g.session.familyId, name }).select('id').single();
      universityId = created?.id;
    }
  }

  const { error } = await g.supabase.from('student_profiles').update({
    course: input.course || null,
    student_ref: input.studentRef || null,
    ...(universityId ? { university_id: universityId } : {}),
  }).eq('id', input.studentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/university');
  return { ok: true };
}

export interface AcademicYearInput {
  studentId: string;
  label: string;
  studyYear?: number | null;
  status: string;
}

export async function addAcademicYear(input: AcademicYearInput): Promise<Result> {
  if (!input.label.trim()) return { ok: false, error: 'Label is required (e.g. 2026/27).' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('academic_years').insert({
    student_id: input.studentId,
    label: input.label.trim(),
    study_year: input.studyYear ?? null,
    status: input.status || 'upcoming',
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/university');
  return { ok: true };
}

export async function updateAcademicYear(input: AcademicYearInput & { id: string }): Promise<Result> {
  if (!input.label.trim()) return { ok: false, error: 'Label is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('academic_years').update({
    label: input.label.trim(),
    study_year: input.studyYear ?? null,
    status: input.status || 'upcoming',
  }).eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/university');
  return { ok: true };
}

export async function deleteAcademicYear(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('academic_years').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/university');
  return { ok: true };
}

// ── Scholarship: scholarship, requirements, funding ───────────────────────────
async function ensureScholarship(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  studentId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('scholarships').select('id').eq('student_id', studentId)
    .order('start_date', { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase
    .from('scholarships').insert({ student_id: studentId, stage: 'family_funded' }).select('id').single();
  return created?.id ?? null;
}

export async function upsertScholarship(input: { studentId: string; id?: string; sponsor?: string; stage: string }): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_scholarship');
  if (!g.ok) return g;
  if (input.id) {
    const { error } = await g.supabase.from('scholarships')
      .update({ sponsor: input.sponsor || null, stage: input.stage }).eq('id', input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await g.supabase.from('scholarships')
      .insert({ student_id: input.studentId, sponsor: input.sponsor || null, stage: input.stage });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath('/scholarship');
  return { ok: true };
}

export interface RequirementInput {
  studentId: string;
  scholarshipId?: string | null;
  title: string;
  kind?: string;
  dueDate?: string | null;
}

export async function addRequirement(input: RequirementInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_scholarship');
  if (!g.ok) return g;
  const scholarshipId = input.scholarshipId ?? (await ensureScholarship(g.supabase, input.studentId));
  if (!scholarshipId) return { ok: false, error: 'Could not attach requirement.' };
  const { error } = await g.supabase.from('scholarship_requirements').insert({
    scholarship_id: scholarshipId,
    title: input.title.trim(),
    kind: input.kind || null,
    due_date: input.dueDate || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/scholarship');
  return { ok: true };
}

export async function updateRequirement(input: { id: string; title: string; kind?: string; dueDate?: string | null; completed?: boolean }): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_scholarship');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('scholarship_requirements').update({
    title: input.title.trim(),
    kind: input.kind || null,
    due_date: input.dueDate || null,
    ...(input.completed === undefined ? {} : { completed: input.completed }),
  }).eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/scholarship');
  return { ok: true };
}

export async function toggleRequirement(id: string, completed: boolean): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_scholarship');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('scholarship_requirements').update({ completed }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/scholarship');
  return { ok: true };
}

export async function deleteRequirement(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_scholarship');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('scholarship_requirements').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/scholarship');
  return { ok: true };
}

export interface FundingInput {
  studentId: string;
  label: string;
  kind: string;
  sponsor?: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
}

export async function addFunding(input: FundingInput): Promise<Result> {
  if (!input.label.trim()) return { ok: false, error: 'Label is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_scholarship');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('funding_sources').insert({
    family_id: g.session.familyId,
    student_id: input.studentId,
    label: input.label.trim(),
    kind: input.kind || 'other',
    sponsor: input.sponsor || null,
    status: input.status || 'active',
    start_date: input.startDate || new Date().toISOString().slice(0, 10),
    end_date: input.endDate || null,
    created_by: g.userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/scholarship');
  return { ok: true };
}

export async function updateFunding(input: FundingInput & { id: string }): Promise<Result> {
  if (!input.label.trim()) return { ok: false, error: 'Label is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_scholarship');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('funding_sources').update({
    label: input.label.trim(),
    kind: input.kind || 'other',
    sponsor: input.sponsor || null,
    status: input.status || 'active',
    start_date: input.startDate || undefined,
    end_date: input.endDate || null,
  }).eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/scholarship');
  return { ok: true };
}

export async function deleteFunding(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_scholarship');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('funding_sources').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/scholarship');
  return { ok: true };
}

// ── Student milestones ────────────────────────────────────────────────────────
export interface MilestoneInput {
  studentId: string;
  kind?: string;
  title: string;
  description?: string;
  occurredOn?: string | null;
}

export async function addMilestone(input: MilestoneInput): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('student_milestones').insert({
    student_id: input.studentId, kind: input.kind || 'other', title: input.title.trim(),
    description: input.description || null, occurred_on: input.occurredOn || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/students/${input.studentId}`);
  return { ok: true };
}

export async function updateMilestone(input: MilestoneInput & { id: string }): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Title is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('student_milestones').update({
    kind: input.kind || 'other', title: input.title.trim(),
    description: input.description || null, occurred_on: input.occurredOn || null,
  }).eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/students/${input.studentId}`);
  return { ok: true };
}

export async function deleteMilestone(id: string, studentId: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('student_milestones').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

// ── Academic terms (within a year) ────────────────────────────────────────────
export interface TermInput {
  academicYearId: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string;
}

export async function addAcademicTerm(input: TermInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: 'Term name is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('academic_terms').insert({
    academic_year_id: input.academicYearId, name: input.name.trim(),
    start_date: input.startDate || null, end_date: input.endDate || null, notes: input.notes || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/university');
  return { ok: true };
}

export async function deleteAcademicTerm(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('admin_parent');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('academic_terms').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/university');
  return { ok: true };
}
