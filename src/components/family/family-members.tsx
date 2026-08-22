'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Settings2, Check, Loader2, ShieldCheck, Trash2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Select } from '@/components/ui/field';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import {
  setMemberEmail, updateMemberRole, setMemberStatus, setMemberRelationship,
  getMemberPermissions, setMemberPermission, deleteFamilyMember, type MemberPermissionRow,
} from '@/lib/actions/family';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import { PERMISSION_LABELS, type Permission } from '@/lib/permissions';
import type { Member } from '@/lib/types';
import type { SystemRole } from '@/lib/permissions';

const roleTone = (m: Member) => (m.role === 'admin' ? 'navy' : m.role === 'parent' ? 'brand' : m.isStudent ? 'success' : 'neutral');

export function FamilyMembers({ members, canManage, currentMemberId, familyId }: { members: Member[]; canManage: boolean; currentMemberId?: string; familyId: string }) {
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
            <Avatar name={m.displayName} src={m.avatarUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-navy">{m.displayName}</p>
              <p className="text-sm capitalize text-muted-foreground">{m.relationship}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Chip tone={roleTone(m)}>{m.role.replace('_', ' ')}</Chip>
                {m.linked ? <Chip tone="success">signed in</Chip> : m.inviteEmail ? <Chip tone="brand">invited</Chip> : <Chip tone="neutral">no login</Chip>}
              </div>
              {m.inviteEmail && <p className="mt-1 truncate text-xs text-muted-foreground">{m.inviteEmail}</p>}
            </div>
            {canManage && (
              <div className="flex flex-col gap-1">
                <ManageDialog member={m} isSelf={m.id === currentMemberId} familyId={familyId} />
                <PermissionsDialog member={m} />
              </div>
            )}
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

function PermissionsDialog({ member }: { member: Member }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<MemberPermissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [, start] = useTransition();

  const load = async () => {
    setLoading(true);
    setRows(await getMemberPermissions(member.id, member.role));
    setLoading(false);
  };
  const onOpen = (o: boolean) => { setOpen(o); if (o) void load(); };

  const cycle = (row: MemberPermissionRow) => {
    // null (default) → true (allow) → false (deny) → null
    const next: boolean | null = row.override === null ? true : row.override === true ? false : null;
    setRows((rs) => rs.map((r) => r.key === row.key ? { ...r, override: next, effective: next ?? r.roleDefault } : r));
    start(async () => { await setMemberPermission(member.id, row.key as Permission, next); router.refresh(); });
  };

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <button aria-label={`Permissions for ${member.displayName}`} className="rounded-lg p-2 text-navy-300 hover:bg-muted hover:text-navy">
          <ShieldCheck className="size-5" />
        </button>
      </DialogTrigger>
      <DialogContent title={`${member.displayName}’s permissions`}>
        <p className="mb-3 text-xs text-muted-foreground">
          Tap a permission to cycle: <b>Default</b> (follows role) → <b className="text-success">Allow</b> → <b className="text-danger">Deny</b>. Admins always have everything.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
            {rows.map((r) => (
              <button key={r.key} type="button" onClick={() => cycle(r)}
                className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left hover:bg-muted">
                <span className="text-sm font-medium text-navy">{PERMISSION_LABELS[r.key]}</span>
                {r.override === null
                  ? <Chip tone={r.roleDefault ? 'neutral' : 'neutral'}>Default {r.roleDefault ? '· on' : '· off'}</Chip>
                  : r.override
                    ? <Chip tone="success">Allow</Chip>
                    : <Chip tone="danger">Deny</Chip>}
              </button>
            ))}
          </div>
        )}
        <div className="pt-3">
          <DialogClose asChild><Button type="button" variant="outline" className="w-full">Done</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManageDialog({ member, isSelf, familyId }: { member: Member; isSelf: boolean; familyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onDelete = () => {
    setError(null);
    start(async () => {
      const r = await deleteFamilyMember(member.id);
      if (!r.ok) { setError(r.error); setConfirmDelete(false); return; }
      setOpen(false);
      router.refresh();
    });
  };

  const onSubmit = (formData: FormData) => {
    const email = String(formData.get('email') ?? '');
    const role = String(formData.get('role') ?? member.role) as SystemRole;
    const relationship = String(formData.get('relationship') ?? '');
    setError(null);
    start(async () => {
      const r1 = await setMemberEmail(member.id, email);
      if (!r1.ok) { setError(r1.error); return; }
      if (role !== member.role) {
        const r2 = await updateMemberRole(member.id, role);
        if (!r2.ok) { setError(r2.error); return; }
      }
      await setMemberRelationship(member.id, relationship);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setConfirmDelete(false); setError(null); } }}>
      <DialogTrigger asChild>
        <button aria-label={`Manage ${member.displayName}`} className="rounded-lg p-2 text-navy-300 hover:bg-muted hover:text-navy">
          <Settings2 className="size-5" />
        </button>
      </DialogTrigger>
      <DialogContent title={`Manage ${member.displayName}`}>
        <div className="mb-4 flex justify-center border-b border-border pb-4">
          <AvatarUpload
            memberId={member.id}
            familyId={familyId}
            name={member.displayName}
            currentUrl={member.avatarUrl}
            admin
          />
        </div>
        <form action={onSubmit} className="space-y-3">
          <Field label="Login email" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={member.inviteEmail ?? ''} placeholder="name@example.com" />
          </Field>
          <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">
            <Mail className="mr-1 inline size-3.5" />
            Set this to the email {member.displayName} will sign up with. When they create an account with it, they&apos;ll land straight into this profile as <b className="capitalize">{member.role.replace('_', ' ')}</b>.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role" htmlFor="role">
              <Select id="role" name="role" defaultValue={member.role}>
                <option value="family_member">Family member</option>
                <option value="parent">Parent</option>
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            <Field label="Relationship" htmlFor="relationship">
              <Input id="relationship" name="relationship" defaultValue={member.relationship ?? ''} placeholder="e.g. son, dad" />
            </Field>
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>

        {!isSelf && (
          <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-danger">
              <AlertTriangle className="size-3.5" /> Danger zone
            </p>
            {!confirmDelete ? (
              <>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Remove {member.displayName} from the family. Their tasks and messages stay, but they lose access and their profile is deleted. This can’t be undone.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full border-danger/40 text-danger hover:bg-danger/10"
                  onClick={() => setConfirmDelete(true)}
                  disabled={pending}
                >
                  <Trash2 className="mr-1.5 size-4" /> Delete member
                </Button>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-sm font-semibold text-navy">
                  Delete {member.displayName}? This can’t be undone.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={pending}>
                    Keep
                  </Button>
                  <Button type="button" variant="danger" className="flex-1" onClick={onDelete} disabled={pending}>
                    {pending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Trash2 className="mr-1.5 size-4" />}
                    Yes, delete
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
