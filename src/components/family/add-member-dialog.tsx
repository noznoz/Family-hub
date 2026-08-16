'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { addFamilyMember } from '@/lib/actions/family';
import type { SystemRole } from '@/lib/permissions';

const RELATIONSHIPS = [
  'dad', 'mom', 'step_dad', 'step_mom', 'brother', 'sister', 'son', 'daughter',
  'guardian', 'grandfather', 'grandmother', 'other',
];

export function AddMemberDialog({ live }: { live: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (formData: FormData) => {
    const displayName = String(formData.get('displayName') ?? '').trim();
    const role = String(formData.get('role') ?? 'family_member') as SystemRole;
    const relationship = String(formData.get('relationship') ?? '') || undefined;
    const inviteEmail = String(formData.get('inviteEmail') ?? '') || undefined;
    if (!displayName) {
      setError('Name is required.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addFamilyMember({ displayName, role, relationship, inviteEmail });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      if (live) router.refresh();
      else router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand" size="sm"><UserPlus className="size-4" /> Add member</Button>
      </DialogTrigger>
      <DialogContent title="Add family member">
        <form action={onSubmit} className="space-y-3">
          <Field label="Name" htmlFor="displayName">
            <Input id="displayName" name="displayName" required placeholder="e.g. Grandma" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Relationship" htmlFor="relationship">
              <Select id="relationship" name="relationship" defaultValue="other">
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r} className="capitalize">{r.replace('_', ' ')}</option>
                ))}
              </Select>
            </Field>
            <Field label="Role" htmlFor="role">
              <Select id="role" name="role" defaultValue="family_member">
                <option value="admin">Admin</option>
                <option value="parent">Parent</option>
                <option value="student">Student</option>
                <option value="family_member">Family member</option>
              </Select>
            </Field>
          </div>
          <Field label="Invite email (optional)" htmlFor="inviteEmail">
            <Input id="inviteEmail" name="inviteEmail" type="email" placeholder="name@example.com" />
          </Field>
          {!live && (
            <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">
              Demo mode — this won&apos;t be saved. Connect Supabase to persist members.
            </p>
          )}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="flex-1">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>
              {pending ? 'Adding…' : 'Add member'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
