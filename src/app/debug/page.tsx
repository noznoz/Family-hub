import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Debug' };

type Row = { k: string; v: string; bad?: boolean };

type SB = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/** Run a query with a hard timeout so a hanging RLS policy can't hang this page. */
async function probe(supabase: SB, table: string, filter?: [string, string]): Promise<Row> {
  const t = Date.now();
  try {
    let q = supabase.from(table).select('id').limit(1);
    if (filter) q = q.eq(filter[0], filter[1]);
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT 6s — query hung')), 6000));
    const res = (await Promise.race([q, timeout])) as { error: { code: string; message: string } | null };
    const ms = Date.now() - t;
    if (res.error) return { k: `probe ${table}`, v: `[${res.error.code}] ${res.error.message} (${ms}ms)`, bad: true };
    return { k: `probe ${table}`, v: `ok (${ms}ms)` };
  } catch (e) {
    return { k: `probe ${table}`, v: `${e instanceof Error ? e.message : String(e)} (${Date.now() - t}ms)`, bad: true };
  }
}

export default async function DebugPage() {
  const rows: Row[] = [];
  const add = (k: string, v: unknown, bad = false) =>
    rows.push({ k, v: typeof v === 'string' ? v : JSON.stringify(v), bad });

  try {
    const supabase = await createClient();
    add('server client', !!supabase);
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      add('signed-in user', user ? user.email : 'NONE', !user);

      if (user) {
        const { data: mem } = await supabase
          .from('family_members').select('family_id, display_name, role')
          .eq('profile_id', user.id).eq('status', 'active').maybeSingle();
        add('you are', mem ? `${mem.display_name} / ${mem.role}` : 'NULL', !mem);
        const familyId = (mem as { family_id?: string } | null)?.family_id;

        // Probe every table /home touches — whichever errors/times out is the culprit.
        add('— probing /home tables —', '');
        for (const [table, filter] of [
          ['student_profiles', familyId ? ['family_id', familyId] : undefined],
          ['academic_years', undefined],
          ['funding_sources', undefined],
          ['tasks', familyId ? ['family_id', familyId] : undefined],
          ['trip_members', undefined],
          ['trips', undefined],
          ['payment_requests', familyId ? ['family_id', familyId] : undefined],
          ['documents', familyId ? ['family_id', familyId] : undefined],
          ['universities', familyId ? ['family_id', familyId] : undefined],
        ] as [string, [string, string] | undefined][]) {
          rows.push(await probe(supabase, table, filter));
        }
      }
    }
    const admin = createAdminClient();
    add('admin client', !!admin, !admin);
  } catch (e) {
    add('EXCEPTION', e instanceof Error ? `${e.name}: ${e.message}` : String(e), true);
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif', color: '#0A1E36' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Family Hub — Debug v2</h1>
      <p style={{ color: '#5A6b80', fontSize: 13, margin: '0 0 16px' }}>Send me a screenshot. Red = the problem.</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {rows.map((r, i) => (
          <li key={i} style={{ padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10, background: r.bad ? '#FCE8E8' : '#fff' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: r.bad ? '#DC2626' : '#0A1E36' }}>{r.bad ? '❌ ' : ''}{r.k}</div>
            <div style={{ fontSize: 13, color: '#334155', marginTop: 2, wordBreak: 'break-all' }}>{r.v}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
