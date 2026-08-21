'use client';

import { useRouter } from 'next/navigation';
import { Calendar as CalIcon, Plus, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton } from '@/components/ui/delete-button';
import { ReminderButton } from '@/components/ui/reminder-button';
import { EventFormDialog } from './event-form-dialog';
import { deleteCalendarEvent } from '@/lib/actions/journey';
import type { CalEvent } from '@/lib/journey-queries';

const kindTone: Record<string, 'brand' | 'attention' | 'danger' | 'success' | 'navy'> = {
  flight: 'brand', tuition: 'danger', rent: 'attention', deadline: 'attention', visa: 'danger', doc_expiry: 'attention',
};

export function CalendarView({
  events, students, live, canManage, meId,
}: {
  events: CalEvent[];
  students: { id: string; name: string }[];
  live: boolean;
  canManage: boolean;
  meId: string;
}) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Calendar</h1>
        {canManage && (
          <EventFormDialog live={live} students={students}
            trigger={<Button variant="brand" size="sm"><Plus className="size-4" /> New</Button>} />
        )}
      </div>
      {events.length === 0 ? (
        <EmptyState icon={<CalIcon className="size-6" />} title="Nothing upcoming" hint="Add flights, payments and deadlines to track them here." />
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
              <div className="flex shrink-0 items-center">
                <ReminderButton entityType="calendar_event" entityId={e.id} title={e.title} link="/calendar" live={live} meId={meId} />
                {canManage ? (
                  <>
                    <EventFormDialog live={live} students={students} event={e}
                      trigger={<button type="button" aria-label="Edit event" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy"><Pencil className="size-4" /></button>} />
                    <DeleteButton itemLabel={`“${e.title}”`} title="Delete event"
                      onConfirm={() => (live ? deleteCalendarEvent(e.id) : Promise.resolve())} onDeleted={() => router.refresh()} />
                  </>
                ) : (
                  <span className="ml-1 text-xs font-semibold text-muted-foreground">{e.when}</span>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
