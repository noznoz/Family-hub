import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface AuditEntry {
  id: string; action: string; entity: string; actor: string; when: string; meta: string;
}

function one<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

export async function getAuditLogs(familyId: string): Promise<AuditEntry[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('audit_logs')
    .select('id, action, entity, meta, created_at, actor:profiles(full_name)')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []).map((a) => {
    const meta = a.meta as Record<string, unknown> | null;
    const metaStr = meta && Object.keys(meta).length ? Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
    return {
      id: a.id,
      action: a.action,
      entity: a.entity ?? '',
      actor: one<{ full_name: string }>(a.actor)?.full_name || 'Someone',
      when: new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      meta: metaStr,
    };
  });
}
