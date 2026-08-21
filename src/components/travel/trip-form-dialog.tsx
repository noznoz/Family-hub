'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createTrip, updateTrip } from '@/lib/actions/journey';
import type { TripView } from '@/lib/journey-queries';

export function TripFormDialog({
  trigger, live, members, trip,
}: {
  trigger: React.ReactNode;
  live: boolean;
  members: { id: string; name: string }[];
  trip?: TripView;
}) {
  const router = useRouter();
  const isEdit = !!trip;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (formData: FormData) => {
    const title = String(formData.get('title') ?? '').trim();
    if (!title) return setError('Title is required.');
    setError(null);
    const memberIds = members.map((m) => m.id).filter((id) => formData.get(`m_${id}`) === 'on');
    const payload = {
      title,
      origin: String(formData.get('origin') ?? ''),
      destination: String(formData.get('destination') ?? ''),
      departAt: String(formData.get('departAt') ?? '') || null,
      destAddress: String(formData.get('destAddress') ?? ''),
      notes: String(formData.get('notes') ?? ''),
      memberIds,
    };
    startTransition(async () => {
      const res = live
        ? (isEdit ? await updateTrip({ id: trip!.id, ...payload }) : await createTrip(payload))
        : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={isEdit ? 'Edit trip' : 'New trip'}>
        <form action={onSubmit} className="space-y-3">
          <Field label="Title" htmlFor="title"><Input id="title" name="title" required defaultValue={trip?.title} placeholder="e.g. Hamza — flight to Manchester" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="origin"><Input id="origin" name="origin" defaultValue={trip?.origin} placeholder="Riyadh" /></Field>
            <Field label="To" htmlFor="destination"><Input id="destination" name="destination" defaultValue={trip?.destination} placeholder="Manchester" /></Field>
          </div>
          <Field label="Departure" htmlFor="departAt"><Input id="departAt" name="departAt" type="datetime-local" defaultValue={trip?.departRaw ? toLocal(trip.departRaw) : undefined} /></Field>
          <Field label="Destination address" htmlFor="destAddress"><Input id="destAddress" name="destAddress" defaultValue={trip?.destAddress} placeholder="Optional" /></Field>
          <Field label="Notes" htmlFor="notes"><Input id="notes" name="notes" defaultValue={trip?.notes} placeholder="Optional" /></Field>
          {members.length > 0 && (
            <Field label="Travellers">
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const checked = trip?.memberIds.includes(m.id);
                  return (
                    <label key={m.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-navy has-[:checked]:border-brand has-[:checked]:bg-brand-muted">
                      <input type="checkbox" name={`m_${m.id}`} defaultChecked={checked} className="accent-brand" /> {m.name}
                    </label>
                  );
                })}
              </div>
            </Field>
          )}
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add trip'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
