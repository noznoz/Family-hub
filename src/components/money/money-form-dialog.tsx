'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { uploadMedia } from '@/lib/storage';
import {
  createExpense, createPaymentRequest, updateExpense, updatePaymentRequest,
} from '@/lib/actions/money';
import type { Expense, ExpenseCategory, PaymentRequest, TaskPriority } from '@/lib/types';

const CATEGORIES: ExpenseCategory[] = [
  'accommodation', 'food', 'transport', 'university', 'travel', 'shopping', 'entertainment', 'phone', 'other',
];

export function MoneyFormDialog({
  trigger, live, students, mode, defaultStudentId, editExpense, editRequest, familyId,
}: {
  trigger: React.ReactNode;
  live: boolean;
  students: { id: string; name: string }[];
  mode: 'expense' | 'request';
  defaultStudentId?: string;
  editExpense?: Expense;
  editRequest?: PaymentRequest;
  familyId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isRequest = mode === 'request';
  const isEdit = !!editExpense || !!editRequest;
  const initialStudentId = editExpense?.studentId ?? editRequest?.studentId ?? defaultStudentId;

  const onSubmit = (formData: FormData) => {
    const studentId = String(formData.get('studentId') ?? initialStudentId ?? '');
    const amount = Number(formData.get('amount') ?? 0);
    const category = String(formData.get('category') ?? 'other') as ExpenseCategory;
    const description = String(formData.get('description') ?? '');
    if (!studentId) return setError('Choose a student.');
    if (!amount || amount <= 0) return setError('Enter a valid amount.');
    setError(null);

    startTransition(async () => {
      let res;
      if (isRequest) {
        const urgency = String(formData.get('urgency') ?? 'normal') as TaskPriority;
        res = editRequest
          ? await updatePaymentRequest({ id: editRequest.id, studentId, amount, reason: description || 'Payment request', category, urgency })
          : await createPaymentRequest({ studentId, amount, reason: description || 'Payment request', category, urgency });
      } else {
        let receiptPath: string | null | undefined;
        if (receipt && live && familyId) {
          const safe = receipt.name.replace(/[^\w.\-]+/g, '_');
          receiptPath = await uploadMedia(familyId, receipt, `receipts/${Date.now()}-${safe}`);
          if (!receiptPath) return setError('Receipt upload failed. Try again.');
        }
        res = editExpense
          ? await updateExpense({ id: editExpense.id, studentId, amount, category, description, ...(receiptPath ? { receiptPath } : {}) })
          : await createExpense({ studentId, amount, category, description, receiptPath });
      }
      if (!res.ok) return setError(res.error);
      setReceipt(null);
      setOpen(false);
      router.refresh();
    });
  };

  const title = isEdit
    ? (isRequest ? 'Edit request' : 'Edit expense')
    : (isRequest ? 'Request money' : 'Add expense');
  const amountDefault = editExpense?.amount ?? editRequest?.amount;
  const categoryDefault = editExpense?.category ?? editRequest?.category ?? 'other';
  const descDefault = editExpense?.description ?? editRequest?.reason;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title}>
        <form action={onSubmit} className="space-y-3">
          {students.length > 1 && !defaultStudentId && (
            <Field label="Student" htmlFor="studentId">
              <Select id="studentId" name="studentId" defaultValue={initialStudentId ?? students[0]?.id}>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          )}
          {defaultStudentId && !isEdit && <input type="hidden" name="studentId" value={defaultStudentId} />}
          {isEdit && initialStudentId && students.length <= 1 && <input type="hidden" name="studentId" value={initialStudentId} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (£)" htmlFor="amount">
              <Input id="amount" name="amount" type="number" inputMode="decimal" min="0" step="0.01" required defaultValue={amountDefault} placeholder="0.00" />
            </Field>
            <Field label="Category" htmlFor="category">
              <Select id="category" name="category" defaultValue={categoryDefault} className="capitalize">
                {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={isRequest ? 'Reason' : 'Description'} htmlFor="description">
            <Input id="description" name="description" defaultValue={descDefault} placeholder={isRequest ? 'e.g. Textbooks for Term 1' : 'e.g. Groceries'} required={isRequest} />
          </Field>
          {isRequest && (
            <Field label="Urgency" htmlFor="urgency">
              <Select id="urgency" name="urgency" defaultValue={editRequest?.urgency ?? 'normal'}>
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
          )}
          {!isRequest && (
            <div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-semibold text-navy hover:bg-muted">
                <Paperclip className="size-4 text-navy-400" />
                {receipt ? receipt.name : editExpense?.receiptUrl ? 'Replace receipt' : 'Attach receipt (optional)'}
              </button>
            </div>
          )}
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : isRequest ? 'Send request' : 'Add expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
