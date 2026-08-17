import type { Metadata } from 'next';
import { Bell, HandCoins, CalendarClock, FileText, Award, Plane } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getNotifications } from '@/lib/journey-queries';
import { markAllRead } from '@/lib/actions/notifications';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Notifications' };

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  payment_request: HandCoins, payment_due: HandCoins, payment_approved: HandCoins,
  task_due: CalendarClock, document_expiring: FileText, scholarship_deadline: Award,
  trip_approaching: Plane, new_message: Bell, family_update: Bell, system: Bell,
};

export default async function NotificationsPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const items = session.isDemo ? [] : await getNotifications(session.memberId);
  const hasUnread = items.some((i) => i.unread);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Notifications</h1>
        {hasUnread && (
          <form action={markAllRead}><Button type="submit" variant="ghost" size="sm">Mark all read</Button></form>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="You're all caught up" hint="New alerts will appear here." />
      ) : (
        <Card className="divide-y divide-border">
          {items.map((n) => {
            const Icon = icons[n.kind] ?? Bell;
            return (
              <div key={n.id} className="flex items-start gap-3 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand"><Icon className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.when}</p>
                </div>
                {n.unread && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand" />}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
