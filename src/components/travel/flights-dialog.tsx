'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plane, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { addFlight, deleteFlight } from '@/lib/actions/journey';
import type { TripView } from '@/lib/journey-queries';

export function FlightsDialog({ trip, live, canManage, trigger }: { trip: TripView; live: boolean; canManage: boolean; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onAdd = (fd: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = live ? await addFlight({
        tripId: trip.id,
        airline: String(fd.get('airline') ?? ''),
        flightNumber: String(fd.get('flightNumber') ?? ''),
        bookingRef: String(fd.get('bookingRef') ?? ''),
        departAirport: String(fd.get('departAirport') ?? ''),
        arriveAirport: String(fd.get('arriveAirport') ?? ''),
        departAt: String(fd.get('departAt') ?? '') || null,
        arriveAt: String(fd.get('arriveAt') ?? '') || null,
        terminal: String(fd.get('terminal') ?? ''),
        seat: String(fd.get('seat') ?? ''),
        baggage: String(fd.get('baggage') ?? ''),
      }) : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setAdding(false);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    if (live) startTransition(async () => { await deleteFlight(id); router.refresh(); });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={`Flights · ${trip.title}`}>
        <div className="space-y-2">
          {trip.flights.length === 0 && !adding && <p className="text-sm text-muted-foreground">No flights added yet.</p>}
          {trip.flights.map((f) => (
            <div key={f.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-semibold text-navy"><Plane className="size-4 text-brand" /> {f.airline || 'Flight'} {f.flightNumber}</p>
                {canManage && <button onClick={() => remove(f.id)} aria-label="Delete flight" className="text-danger hover:opacity-70"><Trash2 className="size-4" /></button>}
              </div>
              <p className="mt-1 text-sm text-navy">{f.departAirport || '—'} → {f.arriveAirport || '—'}</p>
              {(f.departAt || f.arriveAt) && <p className="text-xs text-muted-foreground">{f.departAt}{f.arriveAt ? ` → ${f.arriveAt}` : ''}</p>}
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {f.bookingRef && <span>Ref: {f.bookingRef}</span>}
                {f.terminal && <span>Terminal {f.terminal}</span>}
                {f.seat && <span>Seat {f.seat}</span>}
                {f.baggage && <span>Bags: {f.baggage}</span>}
              </div>
            </div>
          ))}

          {canManage && !adding && (
            <Button variant="subtle" size="sm" onClick={() => setAdding(true)} className="w-full"><Plus className="size-4" /> Add flight</Button>
          )}

          {adding && (
            <form action={onAdd} className="space-y-2 rounded-xl border border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Airline" htmlFor="airline"><Input id="airline" name="airline" placeholder="BA" /></Field>
                <Field label="Flight no." htmlFor="flightNumber"><Input id="flightNumber" name="flightNumber" placeholder="BA123" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="From" htmlFor="departAirport"><Input id="departAirport" name="departAirport" placeholder="RUH" /></Field>
                <Field label="To" htmlFor="arriveAirport"><Input id="arriveAirport" name="arriveAirport" placeholder="LHR" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Departs" htmlFor="departAt"><Input id="departAt" name="departAt" type="datetime-local" /></Field>
                <Field label="Arrives" htmlFor="arriveAt"><Input id="arriveAt" name="arriveAt" type="datetime-local" /></Field>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Terminal" htmlFor="terminal"><Input id="terminal" name="terminal" /></Field>
                <Field label="Seat" htmlFor="seat"><Input id="seat" name="seat" /></Field>
                <Field label="Baggage" htmlFor="baggage"><Input id="baggage" name="baggage" placeholder="23kg" /></Field>
              </div>
              <Field label="Booking ref" htmlFor="bookingRef"><Input id="bookingRef" name="bookingRef" /></Field>
              {error && <p className="text-sm font-medium text-danger">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setAdding(false)}>Cancel</Button>
                <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : 'Add'}</Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
