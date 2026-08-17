import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Setup status' };

function reason(e: unknown): string {
  if (e instanceof Error) {
    const cause = (e as { cause?: { message?: string; code?: string } }).cause;
    return `${e.message}${cause?.code ? ` [${cause.code}]` : ''}${cause?.message ? ` — ${cause.message}` : ''}`;
  }
  return String(e);
}

interface Row { label: string; ok: boolean; detail: string }

async function runChecks(): Promise<Row[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const rows: Row[] = [];

  rows.push({ label: 'NEXT_PUBLIC_SUPABASE_URL', ok: !!url, detail: url || 'MISSING' });
  rows.push({ label: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', ok: !!anon, detail: anon ? `set — ${anon.length} chars` : 'MISSING' });
  rows.push({ label: 'SUPABASE_SERVICE_ROLE_KEY', ok: !!svc, detail: svc ? `set — ${svc.length} chars` : 'MISSING' });

  // Can the server reach Supabase Auth at all?
  let health = 'skipped (no URL)';
  let healthOk = false;
  if (url) {
    try {
      const r = await fetch(`${url}/auth/v1/health`, { headers: anon ? { apikey: anon } : {}, cache: 'no-store' });
      health = `HTTP ${r.status}`;
      healthOk = r.ok;
    } catch (e) {
      health = `FETCH FAILED: ${reason(e)}`;
    }
  }
  rows.push({ label: 'Reach Supabase (auth health)', ok: healthOk, detail: health });

  // Does the service_role key work against the admin API?
  let adminMsg = 'skipped (missing URL or service key)';
  let adminOk = false;
  if (url && svc) {
    try {
      const r = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1`, {
        headers: { apikey: svc, Authorization: `Bearer ${svc}` },
        cache: 'no-store',
      });
      adminMsg = `HTTP ${r.status}${r.status === 401 || r.status === 403 ? ' — service key rejected (wrong key?)' : r.ok ? ' — OK' : ''}`;
      adminOk = r.ok;
    } catch (e) {
      adminMsg = `FETCH FAILED: ${reason(e)}`;
    }
  }
  rows.push({ label: 'Service role admin API', ok: adminOk, detail: adminMsg });

  return rows;
}

export default async function StatusPage() {
  const rows = await runChecks();
  const allOk = rows.every((r) => r.ok);
  return (
    <main style={{ maxWidth: 620, margin: '0 auto', padding: '28px 18px', fontFamily: 'system-ui, sans-serif', color: '#0A1E36' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Family Hub — Setup status</h1>
      <p style={{ color: '#5A6b80', margin: '0 0 20px', fontSize: 14 }}>
        Server-side connectivity check. Screenshot this and send it over.
      </p>
      <div style={{
        padding: '10px 14px', borderRadius: 12, marginBottom: 16, fontWeight: 700,
        background: allOk ? '#E5F6EF' : '#FCE8E8', color: allOk ? '#1FA971' : '#DC2626',
      }}>
        {allOk ? '✅ Everything looks connected' : '❌ Something needs fixing (see red rows)'}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
        {rows.map((r) => (
          <li key={r.label} style={{ padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 12, background: '#fff' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {r.ok ? '✅' : '❌'} {r.label}
            </div>
            <div style={{ fontSize: 13, color: '#5A6b80', marginTop: 4, wordBreak: 'break-all' }}>{r.detail}</div>
          </li>
        ))}
      </ul>
      <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 18 }}>
        No secret values are shown here — only whether each is present and reachable.
      </p>
    </main>
  );
}
