'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { setBudget } from '@/lib/actions/money';

export function BudgetDialog({
  trigger, studentId, name, current, currency, live,
}: {
  trigger: React.ReactNode;
  studentId: string;
  name: string;
  current: number;
  currency: string;
  live: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (fd: FormData) => {
    const amount = Number(fd.get('amount') ?? 0);
    if (!Number.isFinite(amount) || amount < 0) return setError('Enter a valid amount.');
    setError(null);
    startTransition(async () => {
      const res = live ? await setBudget(studentId, amount, currency) : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={`${name}’s monthly budget`}>
        <form action={onSubmit} className="space-y-3">
          <Field label={`Budget for this month (${currency})`} htmlFor="amount">
            <Input id="amount" name="amount" type="number" inputMode="decimal" min="0" step="1" defaultValue={current || ''} placeholder="e.g. 800" autoFocus />
          </Field>
          <p className="text-xs text-muted-foreground">Set to 0 to clear the budget. This applies to the current month.</p>
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : 'Save budget'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
