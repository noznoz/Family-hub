'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createGuide, updateGuide } from '@/lib/actions/support';
import type { GuideDetail } from '@/lib/support-queries';

const KINDS = [
  { v: 'laundry', label: 'Laundry' },
  { v: 'home_basic', label: 'Home basics' },
  { v: 'washing_machine', label: 'Washing machine' },
  { v: 'emergency', label: 'Emergency' },
];

export function GuideFormDialog({
  live, kind, guide, trigger,
}: {
  live: boolean;
  kind?: string;
  guide?: GuideDetail;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = !!guide;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (fd: FormData) => {
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return setError('Title is required.');
    setError(null);
    const steps = String(fd.get('steps') ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    const payload = {
      title,
      description: String(fd.get('description') ?? ''),
      kind: String(fd.get('kind') ?? kind ?? 'home_basic'),
      warnings: String(fd.get('warnings') ?? ''),
      steps,
    };
    startTransition(async () => {
      const res = live
        ? (isEdit ? await updateGuide({ id: guide!.id, ...payload }) : await createGuide(payload))
        : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false);
      if (!isEdit && 'id' in res && res.id) router.push(`/support/guides/${res.id}`);
      else router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button variant="brand" size="sm"><Plus className="size-4" /> New</Button>}</DialogTrigger>
      <DialogContent title={isEdit ? 'Edit guide' : 'New guide'}>
        <form action={onSubmit} className="space-y-3">
          <Field label="Title" htmlFor="title"><Input id="title" name="title" required defaultValue={guide?.title} placeholder="e.g. How to use the washing machine" /></Field>
          <Field label="Description" htmlFor="description"><Input id="description" name="description" defaultValue={guide?.description} placeholder="Optional" /></Field>
          <Field label="Category" htmlFor="kind">
            <Select id="kind" name="kind" defaultValue={guide?.kind ?? kind ?? 'home_basic'}>
              {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
            </Select>
          </Field>
          <Field label="Warning (optional)" htmlFor="warnings"><Input id="warnings" name="warnings" defaultValue={guide?.warnings} placeholder="e.g. Never mix bleach with…" /></Field>
          <Field label="Steps (one per line)" htmlFor="steps">
            <textarea id="steps" name="steps" rows={5} defaultValue={guide?.steps.map((s) => s.body).join('\n')} placeholder={'Sort lights and darks\nAdd detergent to drawer\nSelect 30° cycle'} className="flex w-full rounded-xl border border-input bg-white px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </Field>
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create guide'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
