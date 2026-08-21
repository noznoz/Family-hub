'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, History, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { uploadDocument } from '@/lib/storage';
import { updateDocument, deleteDocument, addDocumentVersion, setDocumentShares } from '@/lib/actions/documents';
import type { DocView } from '@/lib/document-queries';

const CATEGORIES = ['passport', 'visa', 'university', 'scholarship', 'accommodation', 'travel', 'insurance', 'banking', 'academic', 'other'];
const VISIBILITY = [
  { v: 'parents_admins', label: 'Parents & admins' },
  { v: 'private_student', label: 'Private to student' },
  { v: 'selected_members', label: 'Selected members' },
  { v: 'entire_family', label: 'Entire family' },
];

export function DocumentRowActions({
  doc, students, members, familyId, live,
}: {
  doc: DocView;
  students: { id: string; name: string }[];
  members: { id: string; name: string }[];
  familyId: string;
  live: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState(doc.visibility);
  const versionRef = useRef<HTMLInputElement>(null);
  const [uploadingVersion, setUploadingVersion] = useState(false);

  const onSubmit = (formData: FormData) => {
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return setError('Name is required.');
    setError(null);
    const category = String(formData.get('category') ?? 'other');
    const studentId = String(formData.get('studentId') ?? '') || null;
    const vis = String(formData.get('visibility') ?? 'parents_admins');
    const expiry = String(formData.get('expiry') ?? '') || null;
    const notes = String(formData.get('notes') ?? '');
    const shareIds = vis === 'selected_members' ? members.map((m) => m.id).filter((id) => formData.get(`s_${id}`) === 'on') : [];
    startTransition(async () => {
      if (live) {
        const res = await updateDocument({ id: doc.id, name, category, studentId, visibility: vis, expiry, notes });
        if (!res.ok) return setError(res.error);
        if (vis === 'selected_members') await setDocumentShares(doc.id, shareIds);
      }
      setOpen(false);
      router.refresh();
    });
  };

  const onNewVersion = async (file: File | undefined) => {
    if (!file || !live) return;
    setUploadingVersion(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const path = await uploadDocument(familyId, file, `documents/${Date.now()}-${safe}`);
      if (path) await addDocumentVersion({ documentId: doc.id, storagePath: path, fileName: file.name, mimeType: file.type, sizeBytes: file.size });
      router.refresh();
    } finally {
      setUploadingVersion(false);
      if (versionRef.current) versionRef.current.value = '';
    }
  };

  return (
    <div className="flex shrink-0 items-center">
      <input ref={versionRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => onNewVersion(e.target.files?.[0])} />
      <button type="button" onClick={() => versionRef.current?.click()} aria-label="Upload new version"
        className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-muted hover:text-navy">
        {uploadingVersion ? <Loader2 className="size-4 animate-spin" /> : <History className="size-4" />}
      </button>

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
                <Select id="visibility" name="visibility" defaultValue={doc.visibility} onChange={(e) => setVisibility(e.target.value)}>
                  {VISIBILITY.map((v) => <option key={v.v} value={v.v}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Expiry date" htmlFor="expiry"><Input id="expiry" name="expiry" type="date" defaultValue={doc.expiryDate ?? undefined} /></Field>
            </div>
            {visibility === 'selected_members' && (
              <Field label="Shared with">
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-navy has-[:checked]:border-brand has-[:checked]:bg-brand-muted">
                      <input type="checkbox" name={`s_${m.id}`} defaultChecked={doc.sharedMemberIds.includes(m.id)} className="accent-brand" /> {m.name}
                    </label>
                  ))}
                </div>
              </Field>
            )}
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
