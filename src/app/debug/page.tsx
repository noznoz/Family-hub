import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { getStudents, getAttention } from '@/lib/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Debug' };

type Row = { k: string; v: string; bad?: boolean };
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} TIMEOUT ${ms}ms`)), ms))]);
}

export default async function DebugPage() {
  const rows: Row[] = [];
  const add = (k: string, v: unknown, bad = false) =>
    rows.push({ k, v: typeof v === 'string' ? v : JSON.stringify(v), bad });

  try {
    const supabase = await createClient();
    const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    add('signed-in user', user ? user.email : 'NONE', !user);

    // THE decisive test: what the app shell actually sees.
    const t = Date.now();
    const su = await withTimeout(getSessionUser(), 9000, 'getSessionUser');
    add('getSessionUser()', su ? `${su.member.displayName} / ${su.member.role} (${Date.now() - t}ms)` : 'NULL → app shell would redirect (the loop)', !su);

    if (su) {
      let t2 = Date.now();
      const s = await withTimeout(getStudents(su.familyId), 9000, 'getStudents');
      add('getStudents()', `${s.length} students (${Date.now() - t2}ms)`);
      t2 = Date.now();
      const a = await withTimeout(getAttention(su.familyId), 9000, 'getAttention');
      add('getAttention()', `${a.length} items (${Date.now() - t2}ms)`);
      add('VERDICT', 'All green — /home should render. If it still spins, hard-refresh / clear the tab.');
    }
  } catch (e) {
    add('EXCEPTION', e instanceof Error ? `${e.name}: ${e.message}` : String(e), true);
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif', color: '#0A1E36' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Family Hub — Debug v4</h1>
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
