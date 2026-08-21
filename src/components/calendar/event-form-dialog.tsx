'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createCalendarEvent, updateCalendarEvent } from '@/lib/actions/journey';
import type { CalEvent } from '@/lib/journey-queries';

const KINDS = ['general', 'flight', 'rent', 'tuition', 'deadline', 'visa', 'doc_expiry', 'travel'];

export function EventFormDialog({
  trigger, live, students, event,
}: {
  trigger: React.ReactNode;
  live: boolean;
  students: { id: string; name: string }[];
  event?: CalEvent;
}) {
  const router = useRouter();
  const isEdit = !!event;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (formData: FormData) => {
    const title = String(formData.get('title') ?? '').trim();
    const startsAt = String(formData.get('startsAt') ?? '');
    if (!title) return setError('Title is required.');
    if (!startsAt) return setError('Pick a date and time.');
    setError(null);
    const payload = {
      title,
      kind: String(formData.get('kind') ?? 'general'),
      startsAt,
      studentId: String(formData.get('studentId') ?? '') || null,
    };
    startTransition(async () => {
      const res = live
        ? (isEdit ? await updateCalendarEvent({ id: event!.id, ...payload }) : await createCalendarEvent(payload))
        : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={isEdit ? 'Edit event' : 'New event'}>
        <form action={onSubmit} className="space-y-3">
          <Field label="Title" htmlFor="title"><Input id="title" name="title" required defaultValue={event?.title} placeholder="e.g. Tuition Term 2 due" /></Field>
          <Field label="Date & time" htmlFor="startsAt"><Input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={event?.startsAtInput || undefined} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue={event?.kind ?? 'general'} className="capitalize">
                {KINDS.map((k) => <option key={k} value={k} className="capitalize">{k.replace(/_/g, ' ')}</option>)}
              </Select>
            </Field>
            <Field label="Student" htmlFor="studentId">
              <Select id="studentId" name="studentId" defaultValue={event?.studentId ?? ''}>
                <option value="">Family</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add event'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
