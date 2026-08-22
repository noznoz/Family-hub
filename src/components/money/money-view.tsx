'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, HandCoins, Check, X, Banknote, Pencil, Wallet, Paperclip, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton } from '@/components/ui/delete-button';
import { ReminderButton } from '@/components/ui/reminder-button';
import { ShareButton } from '@/components/ui/share-button';
import { formatMoney, cn } from '@/lib/utils';
import {
  decidePaymentRequest, markPaid, deleteExpense, deletePaymentRequest,
} from '@/lib/actions/money';
import { MoneyFormDialog } from './money-form-dialog';
import { BudgetDialog } from './budget-dialog';
import type { Expense, PaymentRequest } from '@/lib/types';
import type { BudgetSnapshot } from '@/lib/queries';

function exportExpensesCsv(expenses: Expense[]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ['Date', 'Student', 'Category', 'Description', 'Amount', 'Currency', 'Funding'];
  const rows = expenses.map((e) => [e.spentOn, e.student, e.category, e.description, e.amount, e.currency, e.fundingLabel].map(esc).join(','));
  const csv = [header.map(esc).join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `family-hub-expenses-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const TABS = ['Overview', 'Expenses', 'Requests'] as const;
type Tab = (typeof TABS)[number];

/** Convert using GBP-based rates (matches lib/fx convert). */
function fxConvert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount;
  const rFrom = from === 'GBP' ? 1 : rates[from];
  const rTo = to === 'GBP' ? 1 : rates[to];
  if (!rFrom || !rTo) return amount;
  return (amount / rFrom) * rTo;
}

export function MoneyView({
  live, meId, familyId, displayCurrency, fxRates, budgets, expenses, requests, students, onlyStudent, canManage, canApprove, isStudent,
}: {
  live: boolean;
  meId: string;
  familyId: string;
  displayCurrency: string;
  fxRates: Record<string, number>;
  budgets: BudgetSnapshot[];
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
  const act = (fn: () => Promise<unknown>) => startTransition(async () => { await fn(); router.refresh(); });
  const conv = (amount: number, currency: string) =>
    currency === displayCurrency ? null : `≈ ${formatMoney(fxConvert(amount, currency, displayCurrency, fxRates), displayCurrency)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Money</h1>
        <div className="flex items-center gap-2">
          {expenses.length > 0 && (
            <button type="button" onClick={() => exportExpensesCsv(expenses)} aria-label="Export expenses"
              className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy">
              <Download className="size-4" />
            </button>
          )}
          {(isStudent || canManage) && (
          <MoneyFormDialog
            live={live}
            students={students}
            familyId={familyId}
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
        <div className="space-y-3">
        {expenses.length > 0 && (
          <Card className="flex items-center justify-between p-4">
            <span className="text-sm font-semibold text-muted-foreground">Total spent (this list)</span>
            <span className="text-lg font-extrabold text-navy">
              {formatMoney(expenses.reduce((s, e) => s + fxConvert(e.amount, e.currency, displayCurrency, fxRates), 0), displayCurrency)}
            </span>
          </Card>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {budgets.map((b) => {
            const hasBudget = b.budget > 0;
            const remaining = b.budget - b.spent;
            const pct = hasBudget ? Math.min(100, Math.round((b.spent / b.budget) * 100)) : 0;
            return (
              <Card key={b.studentId} className="p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="font-bold text-navy">{b.name}</p>
                  <div className="flex items-center gap-1">
                    {hasBudget && <Chip tone={remaining < 0 ? 'danger' : 'success'}>{formatMoney(remaining, b.currency)} left</Chip>}
                    {canManage && (
                      <BudgetDialog
                        live={live} studentId={b.studentId} name={b.name} current={b.budget} currency={b.currency}
                        trigger={<button type="button" aria-label="Set budget" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy"><Pencil className="size-4" /></button>}
                      />
                    )}
                  </div>
                </div>
                {hasBudget ? (
                  <>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn('h-full rounded-full', pct > 90 ? 'bg-danger' : 'bg-brand')} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs font-semibold text-muted-foreground">
                      <span>Spent {formatMoney(b.spent, b.currency)}</span>
                      <span>Budget {formatMoney(b.budget, b.currency)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Spent {formatMoney(b.spent, b.currency)} this month</p>
                    {canManage && (
                      <BudgetDialog
                        live={live} studentId={b.studentId} name={b.name} current={0} currency={b.currency}
                        trigger={<Button variant="subtle" size="sm"><Wallet className="size-4" /> Set budget</Button>}
                      />
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
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
                  {canManage ? (
                    <MoneyFormDialog
                      live={live} students={students} familyId={familyId} mode="expense" editExpense={e}
                      trigger={
                        <button type="button" aria-label={`Edit ${e.description || e.category}`} className="block w-full text-left font-semibold text-navy hover:text-brand">
                          {e.description || e.category}
                        </button>
                      }
                    />
                  ) : (
                    <p className="font-semibold text-navy">{e.description || e.category}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Chip tone="navy">{e.student}</Chip>
                    <Chip tone="neutral">{e.category}</Chip>
                    <Chip tone={e.fundingLabel.includes('Scholarship') ? 'success' : 'brand'}>{e.fundingLabel}</Chip>
                    <span className="text-xs text-muted-foreground">{e.spentOn}</span>
                    {e.receiptUrl && (
                      <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                        <Paperclip className="size-3" /> Receipt
                      </a>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block font-bold text-navy">{formatMoney(e.amount, e.currency)}</span>
                  {conv(e.amount, e.currency) && <span className="block text-[11px] text-muted-foreground">{conv(e.amount, e.currency)}</span>}
                </span>
                <div className="flex shrink-0 items-center">
                  <ShareButton text={`💷 Expense: ${e.description || e.category} — ${formatMoney(e.amount, e.currency)} (${e.category}, ${e.student})`} url="/money" />
                  <ReminderButton entityType="expense" entityId={e.id} title={e.description || e.category} link="/money" live={live} meId={meId} />
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center">
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
                  {r.status === 'requested' && (canApprove || isStudent) ? (
                    <MoneyFormDialog
                      live={live} students={students} mode="request" editRequest={r}
                      trigger={
                        <button type="button" aria-label={`Edit request: ${r.reason}`} className="group min-w-0 text-left">
                          <p className="font-bold text-navy group-hover:text-brand">{formatMoney(r.amount, r.currency)}{conv(r.amount, r.currency) && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{conv(r.amount, r.currency)}</span>}</p>
                          <p className="text-sm text-muted-foreground">{r.reason}</p>
                        </button>
                      }
                    />
                  ) : (
                    <div className="min-w-0">
                      <p className="font-bold text-navy">{formatMoney(r.amount, r.currency)}{conv(r.amount, r.currency) && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{conv(r.amount, r.currency)}</span>}</p>
                      <p className="text-sm text-muted-foreground">{r.reason}</p>
                    </div>
                  )}
                  <Chip tone={r.status === 'paid' ? 'success' : r.status === 'rejected' ? 'danger' : r.status === 'approved' ? 'brand' : 'attention'}>
                    {r.status}
                  </Chip>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Chip tone="navy">{r.student}</Chip>
                  <Chip tone="neutral">{r.category}</Chip>
                  <span className="text-xs text-muted-foreground">by {r.requestedBy}</span>
                  <span className="ml-auto flex items-center">
                    <ShareButton text={`💷 Payment request: ${r.reason} — ${formatMoney(r.amount, r.currency)} (${r.category}, ${r.student}) · by ${r.requestedBy}`} url="/money" />
                    <ReminderButton entityType="payment_request" entityId={r.id} title={r.reason} link="/money" live={live} meId={meId} />
                  </span>
                  {r.status === 'requested' && (canApprove || isStudent) && (
                    <span className="flex items-center">
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
