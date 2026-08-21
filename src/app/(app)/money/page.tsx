import type { Metadata } from 'next';
import { Lock } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getExpenses, getPaymentRequests, getStudents } from '@/lib/queries';
import { demoBudgets, demoExpenses, demoRequests, demoStudents } from '@/lib/demo-data';
import { MoneyView } from '@/components/money/money-view';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Money' };

export default async function MoneyPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const { member } = session;

  const canViewFinances = can(member.role, 'view_student_finances');
  const canManage = can(member.role, 'manage_student_finances');
  const canApprove = can(member.role, 'approve_payment_requests');
  const isStudent = member.role === 'student';

  if (!canViewFinances && !isStudent) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Money</h1>
        <EmptyState icon={<Lock className="size-6" />} title="Finances are private"
          hint="You don't have permission to view student finances. Ask an admin to enable it." />
      </div>
    );
  }

  const onlyStudent = isStudent ? (member.displayName as 'Hamza' | 'Omar') : null;

  const [expenses, requests, students] = session.isDemo
    ? [
        onlyStudent ? demoExpenses.filter((e) => e.student === onlyStudent) : demoExpenses,
        onlyStudent ? demoRequests.filter((r) => r.student === onlyStudent) : demoRequests,
        demoStudents.map((s) => ({ id: s.id, name: s.name })),
      ]
    : await Promise.all([
        getExpenses(session.familyId, onlyStudent ?? undefined),
        getPaymentRequests(session.familyId, onlyStudent ?? undefined),
        getStudents(session.familyId).then((ss) => ss.map((s) => ({ id: s.id, name: s.name }))),
      ]);

  return (
    <MoneyView
      live={!session.isDemo}
      meId={session.memberId}
      budgets={demoBudgets}
      expenses={expenses}
      requests={requests}
      students={students}
      onlyStudent={onlyStudent}
      canManage={canManage}
      canApprove={canApprove}
      isStudent={isStudent}
    />
  );
}
