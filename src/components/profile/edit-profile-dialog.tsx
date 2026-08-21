'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { updateMyProfile } from '@/lib/actions/profile';

export function EditProfileDialog({
  displayName, phone, live,
}: {
  displayName: string;
  phone: string | null;
  live: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (fd: FormData) => {
    const name = String(fd.get('displayName') ?? '').trim();
    if (!name) return setError('Name is required.');
    setError(null);
    startTransition(async () => {
      const res = live
        ? await updateMyProfile({ displayName: name, phone: String(fd.get('phone') ?? '') })
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
      <DialogContent title="Edit profile">
        <form action={onSubmit} className="space-y-3">
          <Field label="Name" htmlFor="displayName">
            <Input id="displayName" name="displayName" required defaultValue={displayName} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={phone ?? ''} placeholder="Optional" />
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
