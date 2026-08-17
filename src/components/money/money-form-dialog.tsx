'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createExpense, createPaymentRequest } from '@/lib/actions/money';
import type { ExpenseCategory, TaskPriority } from '@/lib/types';

const CATEGORIES: ExpenseCategory[] = [
  'accommodation', 'food', 'transport', 'university', 'travel', 'shopping', 'entertainment', 'phone', 'other',
];

export function MoneyFormDialog({
  trigger, live, students, mode, defaultStudentId,
}: {
  trigger: React.ReactNode;
  live: boolean;
  students: { id: string; name: string }[];
  mode: 'expense' | 'request';
  defaultStudentId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isRequest = mode === 'request';

  const onSubmit = (formData: FormData) => {
    const studentId = String(formData.get('studentId') ?? defaultStudentId ?? '');
    const amount = Number(formData.get('amount') ?? 0);
    const category = String(formData.get('category') ?? 'other') as ExpenseCategory;
    const description = String(formData.get('description') ?? '');
    if (!studentId) return setError('Choose a student.');
    if (!amount || amount <= 0) return setError('Enter a valid amount.');
    setError(null);

    startTransition(async () => {
      const res = isRequest
        ? await createPaymentRequest({ studentId, amount, reason: description || 'Payment request', category, urgency: (String(formData.get('urgency') ?? 'normal') as TaskPriority) })
        : await createExpense({ studentId, amount, category, description });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={isRequest ? 'Request money' : 'Add expense'}>
        <form action={onSubmit} className="space-y-3">
          {students.length > 1 && !defaultStudentId && (
            <Field label="Student" htmlFor="studentId">
              <Select id="studentId" name="studentId" defaultValue={students[0]?.id}>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          )}
          {defaultStudentId && <input type="hidden" name="studentId" value={defaultStudentId} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (£)" htmlFor="amount">
              <Input id="amount" name="amount" type="number" inputMode="decimal" min="0" step="0.01" required placeholder="0.00" />
            </Field>
            <Field label="Category" htmlFor="category">
              <Select id="category" name="category" defaultValue="other" className="capitalize">
                {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={isRequest ? 'Reason' : 'Description'} htmlFor="description">
            <Input id="description" name="description" placeholder={isRequest ? 'e.g. Textbooks for Term 1' : 'e.g. Groceries'} required={isRequest} />
          </Field>
          {isRequest && (
            <Field label="Urgency" htmlFor="urgency">
              <Select id="urgency" name="urgency" defaultValue="normal">
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
          )}
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>
              {pending ? 'Saving…' : isRequest ? 'Send request' : 'Add expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
