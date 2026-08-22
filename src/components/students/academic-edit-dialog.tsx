'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { updateStudentAcademics } from '@/lib/actions/journey';

export interface AcademicValues {
  universityName: string;
  universityCity: string;
  universityWebsite: string;
  course: string;
  studentRef: string;
  campus: string;
  advisor: string;
  startDate: string; // ISO yyyy-mm-dd
  expectedGraduation: string; // ISO yyyy-mm-dd
}

export function AcademicEditDialog({
  studentId, name, values, live,
}: {
  studentId: string;
  name: string;
  values: AcademicValues;
  live: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (fd: FormData) => {
    const g = (k: string) => String(fd.get(k) ?? '');
    setError(null);
    start(async () => {
      const res = live
        ? await updateStudentAcademics({
            studentId,
            universityName: g('universityName'),
            universityCity: g('universityCity'),
            universityWebsite: g('universityWebsite'),
            course: g('course'),
            studentRef: g('studentRef'),
            campus: g('campus'),
            advisor: g('advisor'),
            startDate: g('startDate') || null,
            expectedGraduation: g('expectedGraduation') || null,
          })
        : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Pencil className="size-4" /> Edit</Button>
      </DialogTrigger>
      <DialogContent title={`${name}’s university & course`}>
        <form action={onSubmit} className="space-y-3">
          <Field label="University" htmlFor="universityName">
            <Input id="universityName" name="universityName" defaultValue={values.universityName} placeholder="e.g. University of Surrey" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" htmlFor="universityCity">
              <Input id="universityCity" name="universityCity" defaultValue={values.universityCity} placeholder="Guildford" />
            </Field>
            <Field label="Website" htmlFor="universityWebsite">
              <Input id="universityWebsite" name="universityWebsite" defaultValue={values.universityWebsite} placeholder="https://…" />
            </Field>
          </div>
          <Field label="Course / major" htmlFor="course">
            <Input id="course" name="course" defaultValue={values.course} placeholder="e.g. BSc Computer Science" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Student ID" htmlFor="studentRef">
              <Input id="studentRef" name="studentRef" defaultValue={values.studentRef} placeholder="Ref / number" />
            </Field>
            <Field label="Campus" htmlFor="campus">
              <Input id="campus" name="campus" defaultValue={values.campus} placeholder="Optional" />
            </Field>
          </div>
          <Field label="Advisor" htmlFor="advisor">
            <Input id="advisor" name="advisor" defaultValue={values.advisor} placeholder="Personal tutor / advisor" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" htmlFor="startDate">
              <Input id="startDate" name="startDate" type="date" defaultValue={values.startDate} />
            </Field>
            <Field label="Expected graduation" htmlFor="expectedGraduation">
              <Input id="expectedGraduation" name="expectedGraduation" type="date" defaultValue={values.expectedGraduation} />
            </Field>
          </div>

          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
