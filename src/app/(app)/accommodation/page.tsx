import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getAccommodations } from '@/lib/journey-queries';
import { getStudentOptions } from '@/lib/document-queries';
import { AccommodationView } from '@/components/accommodation/accommodation-view';

export const metadata: Metadata = { title: 'Accommodation' };

export default async function AccommodationPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const canManage = can(session.member.role, 'manage_travel', session.overrides);
  const [list, students] = session.isDemo
    ? [[], []]
    : await Promise.all([getAccommodations(session.familyId), getStudentOptions(session.familyId)]);

  return <AccommodationView list={list} students={students} live={!session.isDemo} canManage={canManage} meId={session.memberId} familyId={session.familyId} />;
}
