import type { Metadata } from 'next';
import { Plane, Users } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getTrips } from '@/lib/journey-queries';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Travel' };

export default async function TravelPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const trips = session.isDemo ? [] : await getTrips(session.familyId);
  const upcoming = trips.filter((t) => t.upcoming);
  const past = trips.filter((t) => !t.upcoming);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Travel</h1>
      {trips.length === 0 ? (
        <EmptyState icon={<Plane className="size-6" />} title="No trips planned" hint="Flights and trips will appear here." />
      ) : (
        <>
          {upcoming.length > 0 && <Section title="Upcoming" trips={upcoming} tone="brand" />}
          {past.length > 0 && <Section title="Past" trips={past} tone="neutral" />}
        </>
      )}
    </div>
  );
}

function Section({ title, trips, tone }: { title: string; trips: Awaited<ReturnType<typeof getTrips>>; tone: 'brand' | 'neutral' }) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {trips.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-navy">{t.title}</p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Plane className="size-4" /> {t.origin} → {t.destination}
              </p>
              {t.travelers.length > 0 && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3.5" /> {t.travelers.join(', ')}
                </p>
              )}
            </div>
            <Chip tone={tone}>{t.departLabel}</Chip>
          </div>
        </Card>
      ))}
    </section>
  );
}
