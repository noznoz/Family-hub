import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getStudents, getAttention } from '@/lib/queries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Debug' };

type Row = { k: string; v: string; bad?: boolean };

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} TIMEOUT after ${ms}ms — this is the hang`)), ms)),
  ]);
}

export default async function DebugPage() {
  const rows: Row[] = [];
  const add = (k: string, v: unknown, bad = false) =>
    rows.push({ k, v: typeof v === 'string' ? v : JSON.stringify(v), bad });

  try {
    const supabase = await createClient();
    if (!supabase) { add('server client', 'NULL', true); }
    else {
      const { data: { user } } = await supabase.auth.getUser();
      add('signed-in user', user ? user.email : 'NONE', !user);
      if (user) {
        const { data: mem } = await supabase
          .from('family_members').select('family_id, display_name, role')
          .eq('profile_id', user.id).eq('status', 'active').maybeSingle();
        add('you are', mem ? `${mem.display_name} / ${mem.role}` : 'NULL', !mem);
        const familyId = (mem as { family_id?: string } | null)?.family_id;

        if (familyId) {
          add('— running the real /home functions —', '');

          let t = Date.now();
          try {
            const s = await withTimeout(getStudents(familyId), 9000, 'getStudents');
            add('getStudents()', `returned ${s.length} students in ${Date.now() - t}ms`, s.length === 0);
          } catch (e) {
            add('getStudents()', e instanceof Error ? e.message : String(e), true);
          }

          t = Date.now();
          try {
            const a = await withTimeout(getAttention(familyId), 9000, 'getAttention');
            add('getAttention()', `returned ${a.length} items in ${Date.now() - t}ms`);
          } catch (e) {
            add('getAttention()', e instanceof Error ? e.message : String(e), true);
          }
        }
      }
    }
  } catch (e) {
    add('EXCEPTION', e instanceof Error ? `${e.name}: ${e.message}` : String(e), true);
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif', color: '#0A1E36' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Family Hub — Debug v3</h1>
      <p style={{ color: '#5A6b80', fontSize: 13, margin: '0 0 16px' }}>Screenshot &amp; send. Red = the hang.</p>
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
