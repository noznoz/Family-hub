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
}

export async function createAccommodation(input: AccommodationInput): Promise<Result> {
  if (!input.property.trim()) return { ok: false, error: 'Property name is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('accommodations').insert({
    family_id: g.session.familyId,
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
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/accommodation');
  return { ok: true };
}

export async function updateAccommodation(input: AccommodationInput & { id: string }): Promise<Result> {
  if (!input.property.trim()) return { ok: false, error: 'Property name is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard('manage_travel');
  if (!g.ok) return g;
  const { error } = await g.supabase.from('accommodations').update({
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
  }).eq('id', input.id);
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
