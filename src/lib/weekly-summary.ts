import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';
import { notifyMembers } from '@/lib/notify';

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

function fmt(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Build and send the weekly digest for one family (email + in-app). */
export async function sendFamilyDigest(admin: Admin, familyId: string): Promise<boolean> {
  const now = new Date();
  const in7 = new Date(+now + 7 * 86_400_000).toISOString().slice(0, 10);
  const in14 = new Date(+now + 14 * 86_400_000).toISOString();
  const in30 = new Date(+now + 30 * 86_400_000).toISOString().slice(0, 10);
  const nowIso = now.toISOString();

  const [flightsRes, tasksRes, docsRes, reqsRes, membersRes] = await Promise.all([
    admin.from('trips').select('title, depart_at').eq('family_id', familyId).gt('depart_at', nowIso).lte('depart_at', in14).order('depart_at', { ascending: true }),
    admin.from('tasks').select('title, due_date').eq('family_id', familyId).neq('status', 'done').is('parent_task_id', null).not('due_date', 'is', null).lte('due_date', in7).order('due_date', { ascending: true }),
    admin.from('documents').select('name, expiry_date').eq('family_id', familyId).not('expiry_date', 'is', null).lte('expiry_date', in30).order('expiry_date', { ascending: true }),
    admin.from('payment_requests').select('reason, amount, currency').eq('family_id', familyId).eq('status', 'requested'),
    admin.from('family_members').select('id').eq('family_id', familyId).neq('status', 'disabled'),
  ]);

  const flights = flightsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const docs = docsRes.data ?? [];
  const reqs = reqsRes.data ?? [];
  const memberIds = (membersRes.data ?? []).map((m) => m.id);
  if (memberIds.length === 0) return false;

  // Nothing to say → skip (don't send an empty digest).
  if (flights.length === 0 && tasks.length === 0 && docs.length === 0 && reqs.length === 0) return false;

  const lines: string[] = ['Here’s the week ahead for the family:', ''];
  if (flights.length) {
    lines.push('✈️ Upcoming flights:');
    for (const f of flights) lines.push(`  • ${f.title} — ${fmt(f.depart_at)}`);
    lines.push('');
  }
  if (tasks.length) {
    lines.push(`✅ Tasks due this week (${tasks.length}):`);
    for (const t of tasks.slice(0, 6)) lines.push(`  • ${t.title}${t.due_date ? ` — ${fmt(t.due_date)}` : ''}`);
    lines.push('');
  }
  if (docs.length) {
    lines.push('📄 Documents expiring soon:');
    for (const d of docs.slice(0, 6)) lines.push(`  • ${d.name} — ${fmt(d.expiry_date)}`);
    lines.push('');
  }
  if (reqs.length) {
    lines.push(`💷 Open money requests (${reqs.length}):`);
    for (const r of reqs.slice(0, 6)) lines.push(`  • ${r.reason} — ${r.currency} ${r.amount}`);
    lines.push('');
  }

  await notifyMembers({
    familyId,
    memberIds,
    title: 'Family Hub — your week ahead',
    body: lines.join('\n').trim(),
    url: '/home',
    kind: 'family_update',
    push: false,       // a digest doesn't need a phone buzz
    email: true,
  });
  return true;
}

/** Send the weekly digest for every family (used by the scheduled job). */
export async function runWeeklyDigests(admin: Admin): Promise<{ families: number; sent: number }> {
  const { data: families } = await admin.from('families').select('id');
  let sent = 0;
  for (const f of families ?? []) {
    try { if (await sendFamilyDigest(admin, f.id)) sent += 1; }
    catch (e) { console.error('[weekly] family', f.id, e instanceof Error ? e.message : String(e)); }
  }
  return { families: (families ?? []).length, sent };
}
