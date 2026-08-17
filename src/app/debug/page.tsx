import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Debug' };

type Row = { k: string; v: string; bad?: boolean };

export default async function DebugPage() {
  const rows: Row[] = [];
  const add = (k: string, v: unknown, bad = false) =>
    rows.push({ k, v: typeof v === 'string' ? v : JSON.stringify(v), bad });
  const t0 = Date.now();

  try {
    const supabase = await createClient();
    add('server client created', !!supabase);
    if (supabase) {
      let t = Date.now();
      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      add('auth.getUser (ms)', Date.now() - t);
      if (uerr) add('auth.getUser error', uerr.message, true);
      add('signed-in user', user ? `${user.email} (${user.id.slice(0, 8)}…)` : 'NONE — not signed in', !user);

      if (user) {
        // The exact query getSessionUser runs (RLS / authenticated role):
        t = Date.now();
        const { data: mem, error: merr } = await supabase
          .from('family_members')
          .select('id, family_id, display_name, role, status')
          .eq('profile_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        add('RLS members query (ms)', Date.now() - t);
        if (merr) add('RLS members ERROR', `[${merr.code}] ${merr.message}`, true);
        add('RLS member row', mem ?? 'NULL (this causes the redirect loop)', !mem);

        // Ground truth via service role (bypasses RLS):
        const admin = createAdminClient();
        add('admin client created', !!admin, !admin);
        if (admin) {
          const { data: amem, error: aerr } = await admin
            .from('family_members')
            .select('id, display_name, role, status, profile_id')
            .eq('profile_id', user.id);
          if (aerr) add('ADMIN members ERROR', aerr.message, true);
          add('ADMIN member rows for you', amem && amem.length ? amem : 'NONE — onboarding did not link you', !(amem && amem.length));

          const { count: fam } = await admin.from('families').select('*', { count: 'exact', head: true });
          add('families in DB', fam ?? 0);
          const { count: adminsLinked } = await admin
            .from('family_members').select('*', { count: 'exact', head: true })
            .eq('role', 'admin').eq('status', 'active').not('profile_id', 'is', null);
          add('active linked admins', adminsLinked ?? 0);
        }
      }
    }
  } catch (e) {
    add('EXCEPTION', e instanceof Error ? `${e.name}: ${e.message}` : String(e), true);
  }
  add('total (ms)', Date.now() - t0);

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif', color: '#0A1E36' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Family Hub — Debug</h1>
      <p style={{ color: '#5A6b80', fontSize: 13, margin: '0 0 16px' }}>Screenshot this whole page and send it.</p>
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
