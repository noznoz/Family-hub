'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BellPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createReminder } from '@/lib/actions/reminders';

function inOneHour(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Bell button that sets a reminder/alarm on any item. At the chosen time the
 * recipients get a phone push (default tone) + an in-app notice + email. If
 * `members` is passed, the setter can choose who to remind; otherwise it
 * reminds the current member.
 */
export function ReminderButton({
  entityType, entityId, title, link, live, meId, members, iconClassName,
}: {
  entityType: string;
  entityId?: string | null;
  title: string;
  link?: string;
  live: boolean;
  meId: string;
  members?: { id: string; name: string }[];
  iconClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = (fd: FormData) => {
    const remindAt = String(fd.get('remindAt') ?? '');
    if (!remindAt) return setError('Pick a date and time.');
    setError(null);
    const chosen = members?.length
      ? members.map((m) => m.id).filter((id) => fd.get(`r_${id}`) === 'on')
      : [meId];
    const recipientIds = chosen.length ? chosen : [meId];
    startTransition(async () => {
      const res = live
        ? await createReminder({
            entityType, entityId, title, link,
            remindAt,
            body: String(fd.get('note') ?? '') || `Reminder: ${title}`,
            recipientIds,
            channelEmail: fd.get('email') === 'on',
          })
        : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); router.refresh(); }, 800);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); setDone(false); } }}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Set reminder" className={iconClassName ?? 'inline-flex size-8 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-muted hover:text-navy'}>
          <BellPlus className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent title="Set a reminder">
        <form action={onSubmit} className="space-y-3">
          <p className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-navy">{title}</p>
          <Field label="Remind at" htmlFor="remindAt">
            <Input id="remindAt" name="remindAt" type="datetime-local" required defaultValue={inOneHour()} />
          </Field>
          {members && members.length > 0 && (
            <Field label="Remind">
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-navy has-[:checked]:border-brand has-[:checked]:bg-brand-muted">
                    <input type="checkbox" name={`r_${m.id}`} defaultChecked={m.id === meId} className="accent-brand" /> {m.name}
                  </label>
                ))}
              </div>
            </Field>
          )}
          <Field label="Note (optional)" htmlFor="note">
            <Input id="note" name="note" placeholder="Anything to add to the alert" />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-navy">
            <input type="checkbox" name="email" defaultChecked className="accent-brand" /> Also send an email
          </label>
          <p className="text-xs text-muted-foreground">You’ll get a phone notification with your default tone at that time.</p>
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending || done}>
              {done ? 'Reminder set ✓' : pending ? 'Saving…' : 'Set reminder'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
