import type { Metadata } from 'next';
import { Bell, HandCoins, CalendarClock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Notifications' };

const demo = [
  { id: '1', icon: HandCoins, title: 'New payment request', body: 'Omar requested £350 for textbooks', when: '2h ago', unread: true },
  { id: '2', icon: CalendarClock, title: 'Task due soon', body: 'Pay Omar tuition — due in 6 days', when: '5h ago', unread: true },
  { id: '3', icon: Bell, title: 'Family update', body: 'Omar tuition for this term has been paid', when: 'Yesterday', unread: false },
];

export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Notifications</h1>
      {demo.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="You're all caught up" hint="New alerts will appear here." />
      ) : (
        <Card className="divide-y divide-border">
          {demo.map(({ id, icon: Icon, title, body, when, unread }) => (
            <div key={id} className="flex items-start gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{when}</p>
              </div>
              {unread && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand" />}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
