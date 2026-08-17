'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { uploadDocument } from '@/lib/storage';
import { createDocument } from '@/lib/actions/documents';

const CATEGORIES = ['passport', 'visa', 'university', 'scholarship', 'accommodation', 'travel', 'insurance', 'banking', 'academic', 'other'];
const VISIBILITY = [
  { v: 'parents_admins', label: 'Parents & admins' },
  { v: 'private_student', label: 'Private to student' },
  { v: 'entire_family', label: 'Entire family' },
];
const MAX_MB = 15;

export function DocumentUploadDialog({ familyId, students }: { familyId: string; students: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const onSubmit = (formData: FormData) => {
    if (!file) return setError('Choose a file to upload.');
    if (file.size > MAX_MB * 1024 * 1024) return setError(`File too large (max ${MAX_MB}MB).`);
    const name = String(formData.get('name') ?? '').trim() || file.name;
    const category = String(formData.get('category') ?? 'other');
    const studentId = String(formData.get('studentId') ?? '') || null;
    const visibility = String(formData.get('visibility') ?? 'parents_admins');
    const expiry = String(formData.get('expiry') ?? '') || null;
    const notes = String(formData.get('notes') ?? '');
    setError(null);

    startTransition(async () => {
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const path = await uploadDocument(familyId, file, `documents/${Date.now()}-${safe}`);
      if (!path) return setError('Upload failed. Check your connection and try again.');
      const res = await createDocument({
        name, category, studentId, visibility, expiry, notes,
        storagePath: path, fileName: file.name, mimeType: file.type, sizeBytes: file.size,
      });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      setFile(null);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="brand" size="sm"><Upload className="size-4" /> Upload</Button></DialogTrigger>
      <DialogContent title="Upload document">
        <form action={onSubmit} className="space-y-3">
          <Field label="File" htmlFor="file">
            <input id="file" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-navy file:mr-3 file:rounded-lg file:border-0 file:bg-brand-muted file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand" />
          </Field>
          <Field label="Name" htmlFor="name"><Input id="name" name="name" placeholder={file?.name ?? 'e.g. Passport — Hamza'} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="category">
              <Select id="category" name="category" defaultValue="other" className="capitalize">
                {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </Select>
            </Field>
            <Field label="Student" htmlFor="studentId">
              <Select id="studentId" name="studentId" defaultValue="">
                <option value="">Family</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Visibility" htmlFor="visibility">
              <Select id="visibility" name="visibility" defaultValue="parents_admins">
                {VISIBILITY.map((v) => <option key={v.v} value={v.v}>{v.label}</option>)}
              </Select>
            </Field>
            <Field label="Expiry date" htmlFor="expiry"><Input id="expiry" name="expiry" type="date" /></Field>
          </div>
          <Field label="Notes" htmlFor="notes"><Input id="notes" name="notes" placeholder="Optional" /></Field>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>
              {pending ? <><Loader2 className="size-4 animate-spin" /> Uploading…</> : 'Upload'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
