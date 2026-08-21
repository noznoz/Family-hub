'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, HandCoins, Check, X, Banknote, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton } from '@/components/ui/delete-button';
import { ReminderButton } from '@/components/ui/reminder-button';
import { formatMoney, cn } from '@/lib/utils';
import {
  decidePaymentRequest, markPaid, deleteExpense, deletePaymentRequest,
} from '@/lib/actions/money';
import { MoneyFormDialog } from './money-form-dialog';
import type { Expense, PaymentRequest } from '@/lib/types';

type Budgets = Record<'Hamza' | 'Omar', { budget: number; spent: number; currency: string }>;
const TABS = ['Overview', 'Expenses', 'Requests'] as const;
type Tab = (typeof TABS)[number];

export function MoneyView({
  live, meId, budgets, expenses, requests, students, onlyStudent, canManage, canApprove, isStudent,
}: {
  live: boolean;
  meId: string;
  budgets: Budgets;
  expenses: Expense[];
  requests: PaymentRequest[];
  students: { id: string; name: string }[];
  onlyStudent: 'Hamza' | 'Omar' | null;
  canManage: boolean;
  canApprove: boolean;
  isStudent: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Overview');
  const [pending, startTransition] = useTransition();
  const studentNames = (onlyStudent ? [onlyStudent] : (['Hamza', 'Omar'] as const));

  const act = (fn: () => Promise<unknown>) => startTransition(async () => { await fn(); router.refresh(); });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Money</h1>
        {(isStudent || canManage) && (
        <MoneyFormDialog
          live={live}
          students={students}
          mode={isStudent ? 'request' : 'expense'}
          defaultStudentId={onlyStudent ? students.find((s) => s.name === onlyStudent)?.id : undefined}
          trigger={
            <Button variant="brand" size="sm">
              <Plus className="size-4" /> {isStudent ? 'Request' : 'Add'}
            </Button>
          }
        />
        )}
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 rounded-xl py-2 text-sm font-semibold transition-colors', tab === t ? 'bg-navy text-white' : 'bg-muted text-muted-foreground')}>
            {t}
            {t === 'Requests' && requests.filter((r) => r.status === 'requested').length > 0 && (
              <span className="ml-1.5 rounded-full bg-danger px-1.5 text-xs text-white">
                {requests.filter((r) => r.status === 'requested').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-3 md:grid-cols-2">
          {studentNames.map((name) => {
            const b = budgets[name];
            const spent = expenses.filter((e) => e.student === name).reduce((s, e) => s + e.amount, b ? 0 : 0) || b.spent;
            const remaining = b.budget - spent;
            const pct = Math.min(100, Math.round((spent / b.budget) * 100));
            return (
              <Card key={name} className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-bold text-navy">{name}</p>
                  <Chip tone={remaining < 0 ? 'danger' : 'success'}>{formatMoney(remaining, b.currency)} left</Chip>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full', pct > 90 ? 'bg-danger' : 'bg-brand')} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>Spent {formatMoney(spent, b.currency)}</span>
                  <span>Budget {formatMoney(b.budget, b.currency)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'Expenses' && (
        expenses.length === 0 ? (
          <EmptyState title="No expenses yet" hint="Add an expense to start tracking." />
        ) : (
          <Card className="divide-y divide-border">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy">{e.description || e.category}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Chip tone="navy">{e.student}</Chip>
                    <Chip tone="neutral">{e.category}</Chip>
                    <Chip tone={e.fundingLabel.includes('Scholarship') ? 'success' : 'brand'}>{e.fundingLabel}</Chip>
                    <span className="text-xs text-muted-foreground">{e.spentOn}</span>
                  </div>
                </div>
                <span className="shrink-0 font-bold text-navy">{formatMoney(e.amount, e.currency)}</span>
                <div className="flex shrink-0 items-center">
                  <ReminderButton entityType="expense" entityId={e.id} title={e.description || e.category} link="/money" live={live} meId={meId} />
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center">
                    <MoneyFormDialog
                      live={live} students={students} mode="expense" editExpense={e}
                      trigger={
                        <button type="button" aria-label="Edit expense" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-muted hover:text-navy">
                          <Pencil className="size-4" />
                        </button>
                      }
                    />
                    <DeleteButton
                      itemLabel="this expense" title="Delete expense"
                      onConfirm={() => (live ? deleteExpense(e.id) : Promise.resolve())}
                      onDeleted={() => router.refresh()}
                    />
                  </div>
                )}
              </div>
            ))}
          </Card>
        )
      )}

      {tab === 'Requests' && (
        requests.length === 0 ? (
          <EmptyState icon={<HandCoins className="size-6" />} title="No payment requests" hint="Requests from students appear here." />
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-navy">{formatMoney(r.amount, r.currency)}</p>
                    <p className="text-sm text-muted-foreground">{r.reason}</p>
                  </div>
                  <Chip tone={r.status === 'paid' ? 'success' : r.status === 'rejected' ? 'danger' : r.status === 'approved' ? 'brand' : 'attention'}>
                    {r.status}
                  </Chip>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Chip tone="navy">{r.student}</Chip>
                  <Chip tone="neutral">{r.category}</Chip>
                  <span className="text-xs text-muted-foreground">by {r.requestedBy}</span>
                  <span className="ml-auto flex items-center">
                    <ReminderButton entityType="payment_request" entityId={r.id} title={r.reason} link="/money" live={live} meId={meId} />
                  </span>
                  {r.status === 'requested' && (canApprove || isStudent) && (
                    <span className="flex items-center">
                      <MoneyFormDialog
                        live={live} students={students} mode="request" editRequest={r}
                        trigger={
                          <button type="button" aria-label="Edit request" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-muted hover:text-navy">
                            <Pencil className="size-4" />
                          </button>
                        }
                      />
                      <DeleteButton
                        itemLabel="this request" title="Delete request"
                        onConfirm={() => (live ? deletePaymentRequest(r.id) : Promise.resolve())}
                        onDeleted={() => router.refresh()}
                      />
                    </span>
                  )}
                </div>
                {canApprove && r.status === 'requested' && (
                  <div className="mt-3 flex gap-2">
                    <Button variant="success" size="sm" className="flex-1" disabled={pending} onClick={() => act(() => decidePaymentRequest(r.id, 'approved'))}>
                      <Check className="size-4" /> Approve
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" disabled={pending} onClick={() => act(() => decidePaymentRequest(r.id, 'rejected'))}>
                      <X className="size-4" /> Reject
                    </Button>
                  </div>
                )}
                {canApprove && r.status === 'approved' && (
                  <div className="mt-3">
                    <Button variant="brand" size="sm" className="w-full" disabled={pending} onClick={() => act(() => markPaid(r.id, true))}>
                      <Banknote className="size-4" /> Mark paid &amp; record expense
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
