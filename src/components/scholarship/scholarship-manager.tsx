'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Award, Check, Circle, Plus, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton } from '@/components/ui/delete-button';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  upsertScholarship, addRequirement, updateRequirement, toggleRequirement, deleteRequirement,
  addFunding, updateFunding, deleteFunding,
} from '@/lib/actions/journey';
import type { ScholarshipView } from '@/lib/journey-queries';

const STAGES = ['family_funded', 'eligibility', 'application', 'under_review', 'approved', 'active'];
const FUND_KINDS = ['government_scholarship', 'family_funded', 'personal', 'other'];
const FUND_STATUS = ['active', 'pending', 'ended', 'upcoming'];
const label = (s: string) => s.replace(/_/g, ' ');

type Req = ScholarshipView['requirements'][number];
type Fund = ScholarshipView['funding'][number];

export function ScholarshipManager({
  students, live, canManage,
}: {
  students: ScholarshipView[];
  live: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const toggle = (id: string, done: boolean) => { if (live) startTransition(async () => { await toggleRequirement(id, done); router.refresh(); }); };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Scholarship</h1>
      {students.length === 0 ? (
        <EmptyState icon={<Award className="size-6" />} title="No scholarship info yet" hint="Track scholarship status, requirements and funding here." />
      ) : (
        students.map((s) => {
          const stageIdx = STAGES.indexOf(s.stage);
          return (
            <Card key={s.studentId} className="p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-bold text-navy">{s.name}</p>
                <div className="flex items-center gap-1">
                  <Chip tone={s.stage === 'active' ? 'success' : 'brand'} className="capitalize">{label(s.stage)}</Chip>
                  {canManage && (
                    <ScholarshipDialog student={s} live={live}
                      trigger={<button type="button" aria-label="Edit scholarship" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy"><Pencil className="size-4" /></button>} />
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Sponsor: {s.sponsor || '—'}</p>

              <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
                {STAGES.map((stg, i) => (
                  <div key={stg} className="flex items-center gap-1">
                    <span className={'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ' + (i < stageIdx ? 'bg-success-soft text-success' : i === stageIdx ? 'bg-navy text-white' : 'bg-muted text-muted-foreground')}>
                      {label(stg)}
                    </span>
                    {i < STAGES.length - 1 && <span className="text-navy-200">→</span>}
                  </div>
                ))}
              </div>

              {/* Requirements */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Requirements</p>
                  {canManage && (
                    <RequirementDialog studentId={s.studentId} scholarshipId={s.scholarshipId} live={live}
                      trigger={<button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><Plus className="size-3.5" /> Add</button>} />
                  )}
                </div>
                {s.requirements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {s.requirements.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        <button type="button" aria-label={r.done ? 'Mark incomplete' : 'Mark complete'} onClick={() => canManage && toggle(r.id, !r.done)} className={canManage ? 'cursor-pointer' : 'cursor-default'}>
                          {r.done ? <Check className="size-4 text-success" /> : <Circle className="size-4 text-navy-200" />}
                        </button>
                        <span className="flex-1 text-navy">{r.title}</span>
                        <span className="text-xs text-muted-foreground">{r.due}</span>
                        {canManage && (
                          <span className="flex items-center">
                            <RequirementDialog studentId={s.studentId} scholarshipId={s.scholarshipId} live={live} req={r}
                              trigger={<button type="button" aria-label="Edit requirement" className="inline-flex size-7 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy"><Pencil className="size-3.5" /></button>} />
                            <DeleteButton itemLabel={`“${r.title}”`} title="Delete requirement"
                              onConfirm={() => (live ? deleteRequirement(r.id) : Promise.resolve())} onDeleted={() => router.refresh()} />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Funding */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Funding history</p>
                  {canManage && (
                    <FundingDialog studentId={s.studentId} live={live}
                      trigger={<button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><Plus className="size-3.5" /> Add</button>} />
                  )}
                </div>
                {s.funding.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                ) : (
                  <div className="space-y-1">
                    {s.funding.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-navy">{f.label}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-xs text-muted-foreground">{f.start} → {f.end}</span>
                          {canManage && (
                            <>
                              <FundingDialog studentId={s.studentId} live={live} fund={f}
                                trigger={<button type="button" aria-label="Edit funding" className="inline-flex size-7 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy"><Pencil className="size-3.5" /></button>} />
                              <DeleteButton itemLabel={`“${f.label}”`} title="Delete funding source"
                                onConfirm={() => (live ? deleteFunding(f.id) : Promise.resolve())} onDeleted={() => router.refresh()} />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

function ScholarshipDialog({ student, live, trigger }: { student: ScholarshipView; live: boolean; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onSubmit = (fd: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = live ? await upsertScholarship({
        studentId: student.studentId, id: student.scholarshipId ?? undefined,
        sponsor: String(fd.get('sponsor') ?? ''), stage: String(fd.get('stage') ?? 'family_funded'),
      }) : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={`Edit ${student.name}’s scholarship`}>
        <form action={onSubmit} className="space-y-3">
          <Field label="Sponsor" htmlFor="sponsor"><Input id="sponsor" name="sponsor" defaultValue={student.sponsor} placeholder="e.g. Government of …" /></Field>
          <Field label="Stage" htmlFor="stage">
            <Select id="stage" name="stage" defaultValue={student.stage} className="capitalize">
              {STAGES.map((st) => <option key={st} value={st} className="capitalize">{label(st)}</option>)}
            </Select>
          </Field>
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequirementDialog({
  studentId, scholarshipId, live, req, trigger,
}: {
  studentId: string; scholarshipId: string | null; live: boolean; req?: Req; trigger: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = !!req;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onSubmit = (fd: FormData) => {
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return setError('Title is required.');
    setError(null);
    const kind = String(fd.get('kind') ?? '');
    const dueDate = String(fd.get('dueDate') ?? '') || null;
    startTransition(async () => {
      const res = live
        ? (isEdit
          ? await updateRequirement({ id: req!.id, title, kind, dueDate })
          : await addRequirement({ studentId, scholarshipId, title, kind, dueDate }))
        : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={isEdit ? 'Edit requirement' : 'Add requirement'}>
        <form action={onSubmit} className="space-y-3">
          <Field label="Title" htmlFor="title"><Input id="title" name="title" required defaultValue={req?.title} placeholder="e.g. Submit term report" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="kind"><Input id="kind" name="kind" defaultValue={req?.kind} placeholder="document / report" /></Field>
            <Field label="Due date" htmlFor="dueDate"><Input id="dueDate" name="dueDate" type="date" defaultValue={req?.dueDate ?? undefined} /></Field>
          </div>
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

function FundingDialog({
  studentId, live, fund, trigger,
}: {
  studentId: string; live: boolean; fund?: Fund; trigger: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = !!fund;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onSubmit = (fd: FormData) => {
    const lbl = String(fd.get('label') ?? '').trim();
    if (!lbl) return setError('Label is required.');
    setError(null);
    const payload = {
      studentId, label: lbl,
      kind: String(fd.get('kind') ?? 'other'),
      sponsor: String(fd.get('sponsor') ?? ''),
      status: String(fd.get('status') ?? 'active'),
      startDate: String(fd.get('startDate') ?? '') || null,
      endDate: String(fd.get('endDate') ?? '') || null,
    };
    startTransition(async () => {
      const res = live
        ? (isEdit ? await updateFunding({ id: fund!.id, ...payload }) : await addFunding(payload))
        : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={isEdit ? 'Edit funding source' : 'Add funding source'}>
        <form action={onSubmit} className="space-y-3">
          <Field label="Label" htmlFor="label"><Input id="label" name="label" required defaultValue={fund?.label} placeholder="e.g. Government Scholarship" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue={fund?.kind ?? 'other'} className="capitalize">
                {FUND_KINDS.map((k) => <option key={k} value={k} className="capitalize">{label(k)}</option>)}
              </Select>
            </Field>
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue={fund?.status ?? 'active'} className="capitalize">
                {FUND_STATUS.map((st) => <option key={st} value={st} className="capitalize">{st}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Sponsor" htmlFor="sponsor"><Input id="sponsor" name="sponsor" defaultValue={fund?.sponsor} placeholder="Optional" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" htmlFor="startDate"><Input id="startDate" name="startDate" type="date" defaultValue={fund?.startDate ?? undefined} /></Field>
            <Field label="End date" htmlFor="endDate"><Input id="endDate" name="endDate" type="date" defaultValue={fund?.endDate ?? undefined} /></Field>
          </div>
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
