'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Plus, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton } from '@/components/ui/delete-button';
import { ShareButton } from '@/components/ui/share-button';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  updateStudentAcademics, addAcademicYear, updateAcademicYear, deleteAcademicYear,
  addAcademicTerm, deleteAcademicTerm,
} from '@/lib/actions/journey';
import type { UniversityView } from '@/lib/journey-queries';

const YEAR_STATUS = ['upcoming', 'active', 'completed', 'deferred'];
const yearTone = (s: string) => (s === 'active' ? 'success' : s === 'completed' ? 'neutral' : 'brand');

export function UniversityManager({
  students, live, canManage,
}: {
  students: UniversityView[];
  live: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const removeTerm = (id: string) => { if (live) { void deleteAcademicTerm(id).then(() => router.refresh()); } };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">University</h1>
      {students.length === 0 ? (
        <EmptyState icon={<GraduationCap className="size-6" />} title="No university info yet" hint="Add a student profile to track course and academic years." />
      ) : (
        students.map((s) => (
          <Card key={s.studentId} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={s.name} size="lg" />
                <div>
                  <p className="font-bold text-navy">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.university}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ShareButton
                  text={`🎓 ${s.name}\n${s.university}${s.course !== '—' ? ` · ${s.course}` : ''}${s.ref !== '—' ? `\nStudent ID: ${s.ref}` : ''}${s.years.length ? `\n${s.years.map((y) => `Year ${y.studyYear ?? '?'} (${y.status})`).join(', ')}` : ''}`}
                  url="/university" />
                {canManage && (
                  <AcademicsDialog student={s} live={live}
                    trigger={<Button variant="outline" size="sm"><Pencil className="size-4" /> Edit</Button>} />
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><p className="text-xs font-semibold uppercase text-muted-foreground">Course</p><p className="text-navy">{s.course}</p></div>
              <div><p className="text-xs font-semibold uppercase text-muted-foreground">Student ID</p><p className="text-navy">{s.ref}</p></div>
            </div>

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Academic years</p>
                {canManage && (
                  <YearDialog studentId={s.studentId} live={live}
                    trigger={<button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><Plus className="size-3.5" /> Add</button>} />
                )}
              </div>
              {s.years.length === 0 ? (
                <p className="text-sm text-muted-foreground">No years added yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {s.years.map((y) => (
                    <div key={y.id} className="rounded-xl border border-border p-2.5">
                      <div className="flex items-center gap-2">
                        <Chip tone={yearTone(y.status)}>Year {y.studyYear ?? '?'} · {y.label}</Chip>
                        <span className="text-xs capitalize text-muted-foreground">{y.status}</span>
                        {canManage && (
                          <span className="ml-auto flex items-center">
                            <YearDialog studentId={s.studentId} live={live} year={y}
                              trigger={<button type="button" aria-label="Edit year" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy"><Pencil className="size-4" /></button>} />
                            <DeleteButton itemLabel={`year ${y.label}`} title="Delete academic year"
                              onConfirm={() => (live ? deleteAcademicYear(y.id) : Promise.resolve())} onDeleted={() => {}} />
                          </span>
                        )}
                      </div>
                      {(y.terms.length > 0 || canManage) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
                          {y.terms.map((t) => (
                            <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-navy">
                              {t.name}{t.when && <span className="text-muted-foreground">· {t.when}</span>}
                              {canManage && (
                                <button type="button" aria-label="Delete term" onClick={() => removeTerm(t.id)} className="text-danger">×</button>
                              )}
                            </span>
                          ))}
                          {canManage && (
                            <TermDialog yearId={y.id} live={live}
                              trigger={<button type="button" className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-semibold text-brand"><Plus className="size-3" /> Term</button>} />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function AcademicsDialog({ student, live, trigger }: { student: UniversityView; live: boolean; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onSubmit = (fd: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = live ? await updateStudentAcademics({
        studentId: student.studentId,
        course: String(fd.get('course') ?? ''),
        studentRef: String(fd.get('ref') ?? ''),
        universityName: String(fd.get('university') ?? ''),
      }) : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={`Edit ${student.name}’s details`}>
        <form action={onSubmit} className="space-y-3">
          <Field label="University" htmlFor="university"><Input id="university" name="university" defaultValue={student.university === '—' ? '' : student.university} placeholder="e.g. University of Manchester" /></Field>
          <Field label="Course" htmlFor="course"><Input id="course" name="course" defaultValue={student.course === '—' ? '' : student.course} placeholder="e.g. BSc Computer Science" /></Field>
          <Field label="Student ID" htmlFor="ref"><Input id="ref" name="ref" defaultValue={student.ref === '—' ? '' : student.ref} placeholder="Optional" /></Field>
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

function YearDialog({
  studentId, live, year, trigger,
}: {
  studentId: string;
  live: boolean;
  year?: UniversityView['years'][number];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = !!year;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onSubmit = (fd: FormData) => {
    const label = String(fd.get('label') ?? '').trim();
    if (!label) return setError('Label is required.');
    setError(null);
    const n = Number(fd.get('studyYear'));
    const studyYear = Number.isFinite(n) && n > 0 ? n : null;
    const status = String(fd.get('status') ?? 'upcoming');
    startTransition(async () => {
      const res = live
        ? (isEdit
          ? await updateAcademicYear({ id: year!.id, studentId, label, studyYear, status })
          : await addAcademicYear({ studentId, label, studyYear, status }))
        : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={isEdit ? 'Edit academic year' : 'Add academic year'}>
        <form action={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label" htmlFor="label"><Input id="label" name="label" required defaultValue={year?.label} placeholder="2026/27" /></Field>
            <Field label="Study year" htmlFor="studyYear"><Input id="studyYear" name="studyYear" type="number" min="1" inputMode="numeric" defaultValue={year?.studyYear ?? undefined} placeholder="1" /></Field>
          </div>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={year?.status ?? 'upcoming'} className="capitalize">
              {YEAR_STATUS.map((st) => <option key={st} value={st} className="capitalize">{st}</option>)}
            </Select>
          </Field>
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : isEdit ? 'Save' : 'Add year'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TermDialog({ yearId, live, trigger }: { yearId: string; live: boolean; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onSubmit = (fd: FormData) => {
    const name = String(fd.get('name') ?? '').trim();
    if (!name) return setError('Term name is required.');
    setError(null);
    startTransition(async () => {
      const res = live ? await addAcademicTerm({
        academicYearId: yearId, name,
        startDate: String(fd.get('startDate') ?? '') || null,
        endDate: String(fd.get('endDate') ?? '') || null,
      }) : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Add term">
        <form action={onSubmit} className="space-y-3">
          <Field label="Term name" htmlFor="name"><Input id="name" name="name" required placeholder="e.g. Autumn Term" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" htmlFor="startDate"><Input id="startDate" name="startDate" type="date" /></Field>
            <Field label="End" htmlFor="endDate"><Input id="endDate" name="endDate" type="date" /></Field>
          </div>
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : 'Add term'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
