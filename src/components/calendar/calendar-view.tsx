'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar as CalIcon, Plus, ChevronLeft, ChevronRight, Download, List, Grid3x3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton } from '@/components/ui/delete-button';
import { ReminderButton } from '@/components/ui/reminder-button';
import { ShareButton } from '@/components/ui/share-button';
import { EventFormDialog } from './event-form-dialog';
import { deleteCalendarEvent } from '@/lib/actions/journey';
import { cn } from '@/lib/utils';
import type { CalEvent } from '@/lib/journey-queries';

const kindTone: Record<string, 'brand' | 'attention' | 'danger' | 'success' | 'navy'> = {
  flight: 'brand', tuition: 'danger', rent: 'attention', deadline: 'attention', visa: 'danger', doc_expiry: 'attention',
};
const kindColor: Record<string, string> = {
  flight: '#2F6FED', tuition: '#DC2626', rent: '#E8880C', deadline: '#E8880C', visa: '#DC2626', doc_expiry: '#E8880C', general: '#1FA971',
};

function dayKey(input: string): string {
  return input.slice(0, 10); // YYYY-MM-DD
}

/** Build an .ics file of the events and trigger a download. */
function exportIcs(events: CalEvent[]) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const toUtc = (local: string) => {
    const d = new Date(local);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  };
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Family Hub//Calendar//EN'];
  for (const e of events) {
    if (!e.startsAtInput) continue;
    lines.push('BEGIN:VEVENT', `UID:${e.id}@familyhub`, `DTSTART:${toUtc(e.startsAtInput)}`,
      `SUMMARY:${e.title.replace(/\n/g, ' ')}`, e.student ? `DESCRIPTION:${e.student}` : '', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.filter(Boolean).join('\r\n')], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'family-hub-calendar.ics'; a.click();
  URL.revokeObjectURL(url);
}

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
  const [mode, setMode] = useState<'list' | 'month'>('list');
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (!e.startsAtInput) continue;
      const k = dayKey(e.startsAtInput);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Calendar</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <button onClick={() => setMode('list')} aria-label="List view" className={cn('rounded-md p-1.5', mode === 'list' ? 'bg-navy text-white' : 'text-navy-400')}><List className="size-4" /></button>
            <button onClick={() => setMode('month')} aria-label="Month view" className={cn('rounded-md p-1.5', mode === 'month' ? 'bg-navy text-white' : 'text-navy-400')}><Grid3x3 className="size-4" /></button>
          </div>
          {events.length > 0 && (
            <button onClick={() => exportIcs(events)} aria-label="Export calendar" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy"><Download className="size-4" /></button>
          )}
          {canManage && (
            <EventFormDialog live={live} students={students}
              trigger={<Button variant="brand" size="sm"><Plus className="size-4" /> New</Button>} />
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState icon={<CalIcon className="size-6" />} title="Nothing upcoming" hint="Add flights, payments and deadlines to track them here." />
      ) : mode === 'month' ? (
        <MonthGrid cursor={cursor} setCursor={setCursor} byDay={byDay} />
      ) : (
        <Card className="divide-y divide-border">
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-4">
              <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-navy"><CalIcon className="size-5" /></div>
              <div className="min-w-0 flex-1">
                {canManage && !e.derived ? (
                  <EventFormDialog live={live} students={students} event={e}
                    trigger={<button type="button" aria-label={`Edit ${e.title}`} className="block w-full text-left font-semibold text-navy hover:text-brand">{e.title}</button>} />
                ) : (
                  <p className="font-semibold text-navy">{e.title}</p>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <Chip tone={kindTone[e.kind] ?? 'neutral'} className="capitalize">{e.kind.replace(/_/g, ' ')}</Chip>
                  {e.student && <Chip tone="navy">{e.student}</Chip>}
                  {e.derived && <Chip tone="neutral">auto</Chip>}
                  <span className="text-xs text-muted-foreground">{e.whenRaw}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <ShareButton text={`📅 ${e.title}\n${e.whenRaw}${e.student ? ` · ${e.student}` : ''}`} url="/calendar" />
                <ReminderButton entityType="calendar_event" entityId={e.id} title={e.title} link="/calendar" live={live} meId={meId} />
                {canManage && !e.derived && (
                  <DeleteButton itemLabel={`“${e.title}”`} title="Delete event"
                    onConfirm={() => (live ? deleteCalendarEvent(e.id) : Promise.resolve())} onDeleted={() => router.refresh()} />
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function MonthGrid({ cursor, setCursor, byDay }: { cursor: Date; setCursor: (d: Date) => void; byDay: Map<string, CalEvent[]> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const todayKey = new Date().toISOString().slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);

  const move = (delta: number) => { const d = new Date(cursor); d.setMonth(d.getMonth() + delta); setCursor(d); setSelected(null); };
  const selectedEvents = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={() => move(-1)} aria-label="Previous month" className="rounded-lg p-1.5 text-navy-400 hover:bg-muted"><ChevronLeft className="size-5" /></button>
          <p className="font-bold text-navy">{monthLabel}</p>
          <button onClick={() => move(1)} aria-label="Next month" className="rounded-lg p-1.5 text-navy-400 hover:bg-muted"><ChevronRight className="size-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-muted-foreground">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((key, i) => {
            if (!key) return <div key={i} />;
            const evs = byDay.get(key) ?? [];
            const day = Number(key.slice(-2));
            const isToday = key === todayKey;
            return (
              <button key={i} onClick={() => setSelected(key)}
                className={cn('flex aspect-square flex-col items-center justify-start rounded-lg p-1 text-sm',
                  selected === key ? 'bg-brand-muted ring-1 ring-brand' : 'hover:bg-muted',
                  isToday && 'font-extrabold text-brand')}>
                <span>{day}</span>
                <span className="mt-0.5 flex gap-0.5">
                  {evs.slice(0, 3).map((e, j) => <span key={j} className="size-1.5 rounded-full" style={{ background: kindColor[e.kind] ?? '#64748b' }} />)}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {selected && (
        <Card className="divide-y divide-border">
          <p className="p-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {new Date(selected).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {selectedEvents.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nothing on this day.</p>
          ) : selectedEvents.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-4">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: kindColor[e.kind] ?? '#64748b' }} />
              <p className="flex-1 font-medium text-navy">{e.title}</p>
              {e.student && <Chip tone="navy">{e.student}</Chip>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
