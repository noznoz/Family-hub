'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Settings2, Check, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Select } from '@/components/ui/field';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { setMemberEmail, updateMemberRole, setMemberStatus } from '@/lib/actions/family';
import type { Member } from '@/lib/types';
import type { SystemRole } from '@/lib/permissions';

const roleTone = (m: Member) => (m.role === 'admin' ? 'navy' : m.role === 'parent' ? 'brand' : m.isStudent ? 'success' : 'neutral');

export function FamilyMembers({ members, canManage }: { members: Member[]; canManage: boolean }) {
  const pending = members.filter((m) => m.status === 'invited');
  const active = members.filter((m) => m.status !== 'invited');

  return (
    <div className="space-y-5">
      {canManage && pending.length > 0 && (
        <section className="space-y-2">
          <p className="px-1 text-xs font-bold uppercase tracking-wide text-attention">Waiting for approval</p>
          {pending.map((m) => <PendingRow key={m.id} member={m} />)}
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {active.map((m) => (
          <Card key={m.id} className="flex items-center gap-3 p-4">
            <Avatar name={m.displayName} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-navy">{m.displayName}</p>
              <p className="text-sm capitalize text-muted-foreground">{m.relationship}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Chip tone={roleTone(m)}>{m.role.replace('_', ' ')}</Chip>
                {m.linked ? <Chip tone="success">signed in</Chip> : m.inviteEmail ? <Chip tone="brand">invited</Chip> : <Chip tone="neutral">no login</Chip>}
              </div>
              {m.inviteEmail && <p className="mt-1 truncate text-xs text-muted-foreground">{m.inviteEmail}</p>}
            </div>
            {canManage && <ManageDialog member={m} />}
          </Card>
        ))}
      </div>
    </div>
  );
}

function PendingRow({ member }: { member: Member }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [role, setRole] = useState<SystemRole>(member.role);
  const approve = () => start(async () => {
    if (role !== member.role) await updateMemberRole(member.id, role);
    await setMemberStatus(member.id, 'active');
    router.refresh();
  });
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar name={member.displayName} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy">{member.displayName}</p>
          {member.inviteEmail && <p className="truncate text-xs text-muted-foreground">{member.inviteEmail}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Select value={role} onChange={(e) => setRole(e.target.value as SystemRole)} className="h-9 flex-1">
          <option value="family_member">Family member</option>
          <option value="parent">Parent</option>
          <option value="student">Student</option>
          <option value="admin">Admin</option>
        </Select>
        <Button size="sm" variant="success" onClick={approve} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve
        </Button>
      </div>
    </Card>
  );
}

function ManageDialog({ member }: { member: Member }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (formData: FormData) => {
    const email = String(formData.get('email') ?? '');
    const role = String(formData.get('role') ?? member.role) as SystemRole;
    setError(null);
    start(async () => {
      const r1 = await setMemberEmail(member.id, email);
      if (!r1.ok) { setError(r1.error); return; }
      if (role !== member.role) {
        const r2 = await updateMemberRole(member.id, role);
        if (!r2.ok) { setError(r2.error); return; }
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button aria-label={`Manage ${member.displayName}`} className="rounded-lg p-2 text-navy-300 hover:bg-muted hover:text-navy">
          <Settings2 className="size-5" />
        </button>
      </DialogTrigger>
      <DialogContent title={`Manage ${member.displayName}`}>
        <form action={onSubmit} className="space-y-3">
          <Field label="Login email" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={member.inviteEmail ?? ''} placeholder="name@example.com" />
          </Field>
          <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">
            <Mail className="mr-1 inline size-3.5" />
            Set this to the email {member.displayName} will sign up with. When they create an account with it, they&apos;ll land straight into this profile as <b className="capitalize">{member.role.replace('_', ' ')}</b>.
          </p>
          <Field label="Role" htmlFor="role">
            <Select id="role" name="role" defaultValue={member.role}>
              <option value="family_member">Family member</option>
              <option value="parent">Parent</option>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
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
