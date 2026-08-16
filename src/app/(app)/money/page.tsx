import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { demoBudgets, demoExpenses, demoRequests } from '@/lib/demo-data';
import { MoneyView } from '@/components/money/money-view';
import { EmptyState } from '@/components/ui/empty-state';
import { Lock } from 'lucide-react';

export const metadata: Metadata = { title: 'Money' };

export default async function MoneyPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const { member } = session;

  const canViewFinances = can(member.role, 'view_student_finances');
  const canApprove = can(member.role, 'approve_payment_requests');

  // Students see only their own money; family members without finance perms see nothing sensitive.
  if (!canViewFinances && member.role !== 'student') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Money</h1>
        <EmptyState
          icon={<Lock className="size-6" />}
          title="Finances are private"
          hint="You don't have permission to view student finances. Ask an admin to enable it."
        />
      </div>
    );
  }

  const onlyStudent = member.role === 'student' ? (member.displayName as 'Hamza' | 'Omar') : null;

  return (
    <MoneyView
      budgets={demoBudgets}
      expenses={demoExpenses}
      requests={demoRequests}
      onlyStudent={onlyStudent}
      canApprove={canApprove}
    />
  );
}
