import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getScholarshipInfo } from '@/lib/journey-queries';
import { ScholarshipManager } from '@/components/scholarship/scholarship-manager';

export const metadata: Metadata = { title: 'Scholarship' };

export default async function ScholarshipPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const canManage = can(session.member.role, 'manage_scholarship', session.overrides);
  const students = session.isDemo ? [] : await getScholarshipInfo(session.familyId);

  return <ScholarshipManager students={students} live={!session.isDemo} canManage={canManage} />;
}
