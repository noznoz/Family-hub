import type { Metadata } from 'next';
import { ScrollText, ShieldCheck } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getAuditLogs } from '@/lib/audit-queries';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Activity log' };

const actionLabel = (a: string) => a.replace(/[._]/g, ' ');

export default async function AuditPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const canView = can(session.member.role, 'manage_family_members', session.overrides);

  if (!canView) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Activity log</h1>
        <EmptyState icon={<ShieldCheck className="size-6" />} title="Admins only" hint="Ask an admin to view the activity log." />
      </div>
    );
  }

  const logs = session.isDemo ? [] : await getAuditLogs(session.familyId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Activity log</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sensitive changes — approvals, role &amp; permission changes, deletions.</p>
      </div>
      {logs.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-6" />} title="Nothing logged yet" hint="Important actions will show up here." />
      ) : (
        <Card className="divide-y divide-border">
          {logs.map((l) => (
            <div key={l.id} className="flex items-start gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-navy"><ScrollText className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold capitalize text-navy">{actionLabel(l.action)}</p>
                {l.meta && <p className="text-xs text-muted-foreground">{l.meta}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">{l.actor} · {l.when}</p>
              </div>
              {l.entity && <Chip tone="neutral" className="capitalize">{l.entity.replace('_', ' ')}</Chip>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
