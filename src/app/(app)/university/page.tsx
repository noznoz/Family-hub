import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { getUniversityInfo } from '@/lib/journey-queries';
import { UniversityManager } from '@/components/university/university-manager';

export const metadata: Metadata = { title: 'University' };

export default async function UniversityPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const canManage = session.member.role === 'admin' || session.member.role === 'parent';
  const students = session.isDemo ? [] : await getUniversityInfo(session.familyId);

  return <UniversityManager students={students} live={!session.isDemo} canManage={canManage} />;
}
