'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { updateStudentPrivate } from '@/lib/actions/student-private';
import type { StudentPrivate } from '@/lib/queries-student';

export function StudentPrivateDialog({
  studentId, name, data, live,
}: {
  studentId: string;
  name: string;
  data: StudentPrivate | null;
  live: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (fd: FormData) => {
    const g = (k: string) => String(fd.get(k) ?? '');
    setError(null);
    startTransition(async () => {
      const res = live ? await updateStudentPrivate({
        studentId,
        phone: g('phone'), address: g('address'), emergencyContact: g('emergencyContact'),
        doctorGp: g('doctorGp'), bloodType: g('bloodType'),
        bankName: g('bankName'), accountNumber: g('accountNumber'), sortCode: g('sortCode'), iban: g('iban'),
        nationalInsurance: g('nationalInsurance'), brpNumber: g('brpNumber'), passportNumber: g('passportNumber'),
        notes: g('notes'),
      }) : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-white/10 text-white hover:bg-white/20"><Pencil className="size-4" /> Edit info</Button>
      </DialogTrigger>
      <DialogContent title={`${name}’s details`}>
        <form action={onSubmit} className="space-y-4">
          <Group title="Contact">
            <Field label="Phone" htmlFor="phone"><Input id="phone" name="phone" type="tel" defaultValue={data?.phone ?? ''} placeholder="+44 …" /></Field>
            <Field label="Address" htmlFor="address"><Input id="address" name="address" defaultValue={data?.address ?? ''} placeholder="Term-time address" /></Field>
            <Field label="Emergency contact" htmlFor="emergencyContact"><Input id="emergencyContact" name="emergencyContact" defaultValue={data?.emergencyContact ?? ''} placeholder="Name & number" /></Field>
          </Group>

          <Group title="Banking">
            <Field label="Bank" htmlFor="bankName"><Input id="bankName" name="bankName" defaultValue={data?.bankName ?? ''} placeholder="e.g. Monzo" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account number" htmlFor="accountNumber"><Input id="accountNumber" name="accountNumber" inputMode="numeric" defaultValue={data?.accountNumber ?? ''} /></Field>
              <Field label="Sort code" htmlFor="sortCode"><Input id="sortCode" name="sortCode" defaultValue={data?.sortCode ?? ''} placeholder="00-00-00" /></Field>
            </div>
            <Field label="IBAN" htmlFor="iban"><Input id="iban" name="iban" defaultValue={data?.iban ?? ''} placeholder="Optional" /></Field>
          </Group>

          <Group title="Identity">
            <Field label="National Insurance no." htmlFor="nationalInsurance"><Input id="nationalInsurance" name="nationalInsurance" defaultValue={data?.nationalInsurance ?? ''} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="BRP number" htmlFor="brpNumber"><Input id="brpNumber" name="brpNumber" defaultValue={data?.brpNumber ?? ''} /></Field>
              <Field label="Passport no." htmlFor="passportNumber"><Input id="passportNumber" name="passportNumber" defaultValue={data?.passportNumber ?? ''} /></Field>
            </div>
          </Group>

          <Group title="Medical">
            <div className="grid grid-cols-2 gap-3">
              <Field label="GP / doctor" htmlFor="doctorGp"><Input id="doctorGp" name="doctorGp" defaultValue={data?.doctorGp ?? ''} /></Field>
              <Field label="Blood type" htmlFor="bloodType"><Input id="bloodType" name="bloodType" defaultValue={data?.bloodType ?? ''} placeholder="e.g. O+" /></Field>
            </div>
          </Group>

          <Field label="Notes" htmlFor="notes"><Input id="notes" name="notes" defaultValue={data?.notes ?? ''} placeholder="Anything else" /></Field>

          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : 'Save details'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
