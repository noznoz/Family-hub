'use client';

import { useMemo, useState } from 'react';
import { Plus, HandCoins, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatMoney, cn } from '@/lib/utils';
import type { Expense, PaymentRequest } from '@/lib/types';

type Budgets = Record<'Hamza' | 'Omar', { budget: number; spent: number; currency: string }>;
const TABS = ['Overview', 'Expenses', 'Requests'] as const;
type Tab = (typeof TABS)[number];

export function MoneyView({
  budgets,
  expenses,
  requests,
  onlyStudent,
  canApprove,
}: {
  budgets: Budgets;
  expenses: Expense[];
  requests: PaymentRequest[];
  onlyStudent: 'Hamza' | 'Omar' | null;
  canApprove: boolean;
}) {
  const [tab, setTab] = useState<Tab>('Overview');
  const students = (onlyStudent ? [onlyStudent] : (['Hamza', 'Omar'] as const));
  const visibleExpenses = useMemo(
    () => (onlyStudent ? expenses.filter((e) => e.student === onlyStudent) : expenses),
    [expenses, onlyStudent],
  );
  const visibleRequests = useMemo(
    () => (onlyStudent ? requests.filter((r) => r.student === onlyStudent) : requests),
    [requests, onlyStudent],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Money</h1>
        <Button variant="brand" size="sm"><Plus className="size-4" /> Add</Button>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-xl py-2 text-sm font-semibold transition-colors',
              tab === t ? 'bg-navy text-white' : 'bg-muted text-muted-foreground',
            )}
          >
            {t}
            {t === 'Requests' && visibleRequests.length > 0 && (
              <span className="ml-1.5 rounded-full bg-danger px-1.5 text-xs text-white">{visibleRequests.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-3 md:grid-cols-2">
          {students.map((name) => {
            const b = budgets[name];
            const remaining = b.budget - b.spent;
            const pct = Math.min(100, Math.round((b.spent / b.budget) * 100));
            return (
              <Card key={name} className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-bold text-navy">{name}</p>
                  <Chip tone={remaining < 0 ? 'danger' : 'success'}>
                    {formatMoney(remaining, b.currency)} left
                  </Chip>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', pct > 90 ? 'bg-danger' : 'bg-brand')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>Spent {formatMoney(b.spent, b.currency)}</span>
                  <span>Budget {formatMoney(b.budget, b.currency)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'Expenses' && (
        visibleExpenses.length === 0 ? (
          <EmptyState title="No expenses yet" hint="Add an expense to start tracking." />
        ) : (
          <Card className="divide-y divide-border">
            {visibleExpenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy">{e.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Chip tone="navy">{e.student}</Chip>
                    <Chip tone="neutral">{e.category}</Chip>
                    <Chip tone={e.fundingLabel.includes('Scholarship') ? 'success' : 'brand'}>{e.fundingLabel}</Chip>
                    <span className="text-xs text-muted-foreground">{e.spentOn}</span>
                  </div>
                </div>
                <span className="shrink-0 font-bold text-navy">{formatMoney(e.amount, e.currency)}</span>
              </div>
            ))}
          </Card>
        )
      )}

      {tab === 'Requests' && (
        visibleRequests.length === 0 ? (
          <EmptyState icon={<HandCoins className="size-6" />} title="No payment requests" hint="Requests from students appear here." />
        ) : (
          <div className="space-y-2">
            {visibleRequests.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-navy">{formatMoney(r.amount, r.currency)}</p>
                    <p className="text-sm text-muted-foreground">{r.reason}</p>
                  </div>
                  <Chip tone={r.urgency === 'urgent' ? 'danger' : r.urgency === 'important' ? 'attention' : 'neutral'}>
                    {r.status}
                  </Chip>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Chip tone="navy">{r.student}</Chip>
                  <Chip tone="neutral">{r.category}</Chip>
                  <span className="text-xs text-muted-foreground">by {r.requestedBy}</span>
                </div>
                {canApprove && (
                  <div className="mt-3 flex gap-2">
                    <Button variant="success" size="sm" className="flex-1"><Check className="size-4" /> Approve</Button>
                    <Button variant="outline" size="sm" className="flex-1"><X className="size-4" /> Reject</Button>
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
