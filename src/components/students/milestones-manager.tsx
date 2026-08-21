'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Flag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { addMilestone, updateMilestone, deleteMilestone } from '@/lib/actions/journey';
import type { Milestone } from '@/lib/queries-student';

const KINDS = ['preparation', 'arrived', 'started_university', 'scholarship_activated', 'changed_accommodation', 'completed_year', 'internship', 'final_year', 'graduation', 'other'];

export function MilestonesManager({
  studentId, milestones, live, canManage,
}: {
  studentId: string;
  milestones: Milestone[];
  live: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Milestones</p>
        {canManage && <MilestoneDialog studentId={studentId} live={live} trigger={<button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><Plus className="size-3.5" /> Add</button>} />}
      </div>
      {milestones.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">No milestones yet.</Card>
      ) : (
        <Card className="divide-y divide-border">
          {milestones.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand"><Flag className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-navy">{m.title}</p>
                {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
              </div>
              {m.occurred_on && <span className="shrink-0 text-xs text-muted-foreground">{m.occurred_on}</span>}
              {canManage && (
                <span className="flex shrink-0 items-center">
                  <MilestoneDialog studentId={studentId} live={live} milestone={m}
                    trigger={<button type="button" aria-label="Edit milestone" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy"><Pencil className="size-4" /></button>} />
                  <DeleteButton itemLabel={`“${m.title}”`} title="Delete milestone"
                    onConfirm={() => (live ? deleteMilestone(m.id, studentId) : Promise.resolve())} onDeleted={() => router.refresh()} />
                </span>
              )}
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}

function MilestoneDialog({ studentId, live, milestone, trigger }: { studentId: string; live: boolean; milestone?: Milestone; trigger: React.ReactNode }) {
  const router = useRouter();
  const isEdit = !!milestone;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onSubmit = (fd: FormData) => {
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return setError('Title is required.');
    setError(null);
    const payload = {
      studentId, title,
      kind: String(fd.get('kind') ?? 'other'),
      description: String(fd.get('description') ?? ''),
      occurredOn: String(fd.get('occurredOn') ?? '') || null,
    };
    startTransition(async () => {
      const res = live ? (isEdit ? await updateMilestone({ id: milestone!.id, ...payload }) : await addMilestone(payload)) : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={isEdit ? 'Edit milestone' : 'Add milestone'}>
        <form action={onSubmit} className="space-y-3">
          <Field label="Title" htmlFor="title"><Input id="title" name="title" required defaultValue={milestone?.title} placeholder="e.g. Started Year 2" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue={milestone?.kind ?? 'other'} className="capitalize">
                {KINDS.map((k) => <option key={k} value={k} className="capitalize">{k.replace(/_/g, ' ')}</option>)}
              </Select>
            </Field>
            <Field label="Date" htmlFor="occurredOn"><Input id="occurredOn" name="occurredOn" type="date" defaultValue={milestone?.occurredDate ?? undefined} /></Field>
          </div>
          <Field label="Note" htmlFor="description"><Input id="description" name="description" defaultValue={milestone?.description} placeholder="Optional" /></Field>
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : isEdit ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
