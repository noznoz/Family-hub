'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { updateDocument, deleteDocument } from '@/lib/actions/documents';
import type { DocView } from '@/lib/document-queries';

const CATEGORIES = ['passport', 'visa', 'university', 'scholarship', 'accommodation', 'travel', 'insurance', 'banking', 'academic', 'other'];
const VISIBILITY = [
  { v: 'parents_admins', label: 'Parents & admins' },
  { v: 'private_student', label: 'Private to student' },
  { v: 'entire_family', label: 'Entire family' },
];

export function DocumentRowActions({
  doc, students, live,
}: {
  doc: DocView;
  students: { id: string; name: string }[];
  live: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (formData: FormData) => {
    const name = String(formData.get('name') ?? '').trim();
    const category = String(formData.get('category') ?? 'other');
    const studentId = String(formData.get('studentId') ?? '') || null;
    const visibility = String(formData.get('visibility') ?? 'parents_admins');
    const expiry = String(formData.get('expiry') ?? '') || null;
    const notes = String(formData.get('notes') ?? '');
    if (!name) return setError('Name is required.');
    setError(null);
    startTransition(async () => {
      const res = live
        ? await updateDocument({ id: doc.id, name, category, studentId, visibility, expiry, notes })
        : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="flex shrink-0 items-center">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button type="button" aria-label="Edit document" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-muted hover:text-navy">
            <Pencil className="size-4" />
          </button>
        </DialogTrigger>
        <DialogContent title="Edit document">
          <form action={onSubmit} className="space-y-3">
            <Field label="Name" htmlFor="name"><Input id="name" name="name" defaultValue={doc.name} required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" htmlFor="category">
                <Select id="category" name="category" defaultValue={doc.category} className="capitalize">
                  {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                </Select>
              </Field>
              <Field label="Student" htmlFor="studentId">
                <Select id="studentId" name="studentId" defaultValue={doc.studentId ?? ''}>
                  <option value="">Family</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Visibility" htmlFor="visibility">
                <Select id="visibility" name="visibility" defaultValue={doc.visibility}>
                  {VISIBILITY.map((v) => <option key={v.v} value={v.v}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Expiry date" htmlFor="expiry"><Input id="expiry" name="expiry" type="date" defaultValue={doc.expiryDate ?? undefined} /></Field>
            </div>
            <Field label="Notes" htmlFor="notes"><Input id="notes" name="notes" defaultValue={doc.notes} placeholder="Optional" /></Field>
            {error && <p className="text-sm font-medium text-danger">{error}</p>}
            <div className="flex gap-2 pt-1">
              <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
              <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <DeleteButton
        itemLabel={`“${doc.name}”`} title="Delete document"
        onConfirm={() => (live ? deleteDocument(doc.id) : Promise.resolve())}
        onDeleted={() => router.refresh()}
      />
    </div>
  );
}
