import type { Metadata } from 'next';
import { Calendar as CalIcon } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getCalendar } from '@/lib/journey-queries';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Calendar' };

const kindTone: Record<string, 'brand' | 'attention' | 'danger' | 'success' | 'navy'> = {
  flight: 'brand', tuition: 'danger', rent: 'attention', deadline: 'attention', visa: 'danger', doc_expiry: 'attention',
};

export default async function CalendarPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const events = session.isDemo ? [] : await getCalendar(session.familyId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Calendar</h1>
      {events.length === 0 ? (
        <EmptyState icon={<CalIcon className="size-6" />} title="Nothing upcoming" hint="Flights, payments and deadlines will appear here." />
      ) : (
        <Card className="divide-y divide-border">
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-4">
              <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-navy">
                <CalIcon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy">{e.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <Chip tone={kindTone[e.kind] ?? 'neutral'} className="capitalize">{e.kind.replace(/_/g, ' ')}</Chip>
                  {e.student && <Chip tone="navy">{e.student}</Chip>}
                  <span className="text-xs text-muted-foreground">{e.whenRaw}</span>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">{e.when}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
