'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { uploadMedia } from '@/lib/storage';
import { createAccommodation, updateAccommodation } from '@/lib/actions/journey';
import type { AccommodationView } from '@/lib/journey-queries';

export function AccommodationFormDialog({
  trigger, live, students, item, familyId,
}: {
  trigger: React.ReactNode;
  live: boolean;
  students: { id: string; name: string }[];
  item?: AccommodationView;
  familyId?: string;
}) {
  const router = useRouter();
  const isEdit = !!item;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [contract, setContract] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSubmit = (formData: FormData) => {
    const property = String(formData.get('property') ?? '').trim();
    if (!property) return setError('Property name is required.');
    setError(null);
    const num = (k: string) => { const n = Number(formData.get(k)); return Number.isFinite(n) && n > 0 ? n : null; };
    const payload = {
      property,
      studentId: String(formData.get('studentId') ?? '') || null,
      address: String(formData.get('address') ?? ''),
      landlord: String(formData.get('landlord') ?? ''),
      contact: String(formData.get('contact') ?? ''),
      startDate: String(formData.get('startDate') ?? '') || null,
      endDate: String(formData.get('endDate') ?? '') || null,
      monthlyRent: num('monthlyRent'),
      deposit: num('deposit'),
      currency: String(formData.get('currency') ?? 'GBP'),
      wifiInfo: String(formData.get('wifiInfo') ?? ''),
      utilityNotes: String(formData.get('utilityNotes') ?? ''),
      maintenanceNotes: String(formData.get('maintenanceNotes') ?? ''),
    };
    startTransition(async () => {
      let contractPath: string | null | undefined;
      if (contract && live && familyId) {
        const safe = contract.name.replace(/[^\w.\-]+/g, '_');
        contractPath = await uploadMedia(familyId, contract, `accommodation/${Date.now()}-${safe}`);
        if (!contractPath) return setError('Contract upload failed. Try again.');
      }
      const full = { ...payload, ...(contractPath ? { contractPath } : {}) };
      const res = live
        ? (isEdit ? await updateAccommodation({ id: item!.id, ...full }) : await createAccommodation(full))
        : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setContract(null);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={isEdit ? 'Edit accommodation' : 'New accommodation'}>
        <form action={onSubmit} className="space-y-3">
          <Field label="Property" htmlFor="property"><Input id="property" name="property" required defaultValue={item?.property} placeholder="e.g. Unite Students, Manchester" /></Field>
          <Field label="Address" htmlFor="address"><Input id="address" name="address" defaultValue={item?.address} placeholder="Optional" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Student" htmlFor="studentId">
              <Select id="studentId" name="studentId" defaultValue={item?.studentId ?? ''}>
                <option value="">None</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Currency" htmlFor="currency">
              <Select id="currency" name="currency" defaultValue={item?.currency ?? 'GBP'}>
                <option value="GBP">GBP £</option><option value="USD">USD $</option><option value="EUR">EUR €</option><option value="SAR">SAR</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly rent" htmlFor="monthlyRent"><Input id="monthlyRent" name="monthlyRent" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={item?.rentAmount ?? undefined} /></Field>
            <Field label="Deposit" htmlFor="deposit"><Input id="deposit" name="deposit" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={item?.deposit ?? undefined} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" htmlFor="startDate"><Input id="startDate" name="startDate" type="date" defaultValue={item?.startDate ?? undefined} /></Field>
            <Field label="End date" htmlFor="endDate"><Input id="endDate" name="endDate" type="date" defaultValue={item?.endDate ?? undefined} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Landlord" htmlFor="landlord"><Input id="landlord" name="landlord" defaultValue={item?.landlord} placeholder="Optional" /></Field>
            <Field label="Contact" htmlFor="contact"><Input id="contact" name="contact" defaultValue={item?.contact} placeholder="Phone / email" /></Field>
          </div>
          <Field label="Wi-Fi" htmlFor="wifiInfo"><Input id="wifiInfo" name="wifiInfo" defaultValue={item?.wifiInfo} placeholder="Network & password" /></Field>
          <Field label="Utilities notes" htmlFor="utilityNotes"><Input id="utilityNotes" name="utilityNotes" defaultValue={item?.utilityNotes} placeholder="Gas/electric/water accounts, meter, bins day…" /></Field>
          <Field label="Maintenance notes" htmlFor="maintenanceNotes"><Input id="maintenanceNotes" name="maintenanceNotes" defaultValue={item?.maintenanceNotes} placeholder="Who to call, boiler, issues…" /></Field>
          <div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setContract(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-semibold text-navy hover:bg-muted">
              <Paperclip className="size-4 text-navy-400" />
              {contract ? contract.name : item?.contractUrl ? 'Replace contract' : 'Attach tenancy contract (optional)'}
            </button>
          </div>
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
