'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import { sendEmail, emailShell } from '@/lib/email';

type Result = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: 'Not signed in.' };
  if (session.member.role !== 'admin') return { ok: false as const, error: 'Only an admin can change email settings.' };
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, error: 'Backend unavailable.' };
  return { ok: true as const, session, admin };
}

export interface EmailStatus {
  configured: boolean;
  from: string | null;
  tableMissing: boolean;
}

/** Admin-only. Never returns the key itself — only whether one is set. */
export async function getEmailStatus(): Promise<EmailStatus> {
  const g = await requireAdmin();
  if (!g.ok) return { configured: false, from: null, tableMissing: false };
  const { data, error } = await g.admin.from('app_config').select('key, value').in('key', ['resend_api_key', 'email_from']);
  if (error) {
    // 42P01 = table doesn't exist yet (migration not applied).
    return { configured: false, from: null, tableMissing: error.code === '42P01' };
  }
  const key = data?.find((r) => r.key === 'resend_api_key')?.value ?? null;
  const from = data?.find((r) => r.key === 'email_from')?.value ?? null;
  return { configured: !!key, from, tableMissing: false };
}

/** Admin-only. Saves the Resend key and/or sender. Empty apiKey leaves the
 *  existing key untouched (so you can change the sender without re-entering it). */
export async function saveEmailConfig(input: { apiKey?: string; from?: string }): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await requireAdmin();
  if (!g.ok) return g;

  const rows: { key: string; value: string; updated_at: string }[] = [];
  const now = new Date().toISOString();
  const key = input.apiKey?.trim();
  const from = input.from?.trim();
  if (key) rows.push({ key: 'resend_api_key', value: key, updated_at: now });
  if (from !== undefined) rows.push({ key: 'email_from', value: from || 'Family Hub <onboarding@resend.dev>', updated_at: now });
  if (rows.length === 0) return { ok: false, error: 'Nothing to save — enter a key.' };

  const { error } = await g.admin.from('app_config').upsert(rows, { onConflict: 'key' });
  if (error) {
    if (error.code === '42P01') return { ok: false, error: 'Config table not ready yet — please try again in a minute.' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/settings');
  return { ok: true };
}

/** Admin-only. Sends a test email to the signed-in admin's address. */
export async function sendTestEmail(): Promise<Result> {
  const g = await requireAdmin();
  if (!g.ok) return g;

  // Resolve the admin's own email (auth email first, else invite email).
  const supa = await createClient();
  const { data: { user } } = supa ? await supa.auth.getUser() : { data: { user: null } };
  let to: string | null = user?.email ?? null;
  if (!to) {
    const { data: m } = await g.admin.from('family_members').select('invite_email').eq('id', g.session.memberId).maybeSingle();
    to = m?.invite_email ?? null;
  }
  if (!to) return { ok: false, error: 'No email address found for your account.' };

  const res = await sendEmail({
    to,
    subject: 'Family Hub — test email ✅',
    html: emailShell('Email is working', 'This is a test from Family Hub. If you can read this, notifications by email are set up correctly.'),
    text: 'This is a test from Family Hub. Email notifications are set up correctly.',
  });
  if (res.skipped) return { ok: false, error: 'No Resend key saved yet — save your key first.' };
  if (!res.ok) return { ok: false, error: 'Send failed. Check the key, and that your address is allowed (verify a domain in Resend for other recipients).' };
  return { ok: true };
}

/** Admin-only. Send the weekly family digest right now (to this family). */
export async function sendWeeklySummaryNow(): Promise<Result> {
  const g = await requireAdmin();
  if (!g.ok) return g;
  try {
    const { sendFamilyDigest } = await import('@/lib/weekly-summary');
    const sent = await sendFamilyDigest(g.admin, g.session.familyId);
    return sent ? { ok: true } : { ok: false, error: 'Nothing to summarise this week — no upcoming flights, tasks, docs or requests.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to send.' };
  }
}
