'use client';

import { Plane, Users, Plus, Pencil, Ticket } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton } from '@/components/ui/delete-button';
import { ReminderButton } from '@/components/ui/reminder-button';
import { ShareButton } from '@/components/ui/share-button';
import { TripFormDialog } from './trip-form-dialog';
import { FlightsDialog } from './flights-dialog';
import { deleteTrip } from '@/lib/actions/journey';
import { useRouter } from 'next/navigation';
import type { TripView } from '@/lib/journey-queries';

export function TravelView({
  trips, members, live, canManage, meId,
}: {
  trips: TripView[];
  members: { id: string; name: string }[];
  live: boolean;
  canManage: boolean;
  meId: string;
}) {
  const router = useRouter();
  const upcoming = trips.filter((t) => t.upcoming);
  const past = trips.filter((t) => !t.upcoming);

  const section = (title: string, list: TripView[], tone: 'brand' | 'neutral') => (
    <section className="space-y-2">
      <p className="px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {list.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-navy">{t.title}</p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Plane className="size-4" /> {t.origin || '—'} → {t.destination || '—'}
              </p>
              {t.travelers.length > 0 && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3.5" /> {t.travelers.join(', ')}
                </p>
              )}
              <FlightsDialog trip={t} live={live} canManage={canManage}
                trigger={
                  <button type="button" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                    <Ticket className="size-3.5" /> {t.flights.length > 0 ? `${t.flights.length} flight${t.flights.length === 1 ? '' : 's'}` : 'Add flights'}
                  </button>
                } />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Chip tone={tone}>{t.departLabel}</Chip>
              <div className="flex items-center">
                <ShareButton text={`✈️ Trip: ${t.title}\n${t.origin || '—'} → ${t.destination || '—'}\n🗓 ${t.departLabel}${t.travelers.length ? `\n👥 ${t.travelers.join(', ')}` : ''}`} url="/travel" />
                <ReminderButton entityType="trip" entityId={t.id} title={t.title} link="/travel" live={live} meId={meId} members={members} />
                {canManage && (
                  <>
                    <TripFormDialog
                      live={live} members={members} trip={t}
                      trigger={<button type="button" aria-label="Edit trip" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy"><Pencil className="size-4" /></button>}
                    />
                    <DeleteButton itemLabel={`“${t.title}”`} title="Delete trip"
                      onConfirm={() => (live ? deleteTrip(t.id) : Promise.resolve())} onDeleted={() => router.refresh()} />
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </section>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Travel</h1>
        {canManage && (
          <TripFormDialog live={live} members={members}
            trigger={<Button variant="brand" size="sm"><Plus className="size-4" /> New</Button>} />
        )}
      </div>
      {trips.length === 0 ? (
        <EmptyState icon={<Plane className="size-6" />} title="No trips planned" hint="Add flights and trips to keep everyone in sync." />
      ) : (
        <>
          {upcoming.length > 0 && section('Upcoming', upcoming, 'brand')}
          {past.length > 0 && section('Past', past, 'neutral')}
        </>
      )}
    </div>
  );
}
