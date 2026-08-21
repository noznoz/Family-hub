import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getTrips } from '@/lib/journey-queries';
import { getFamilyMembers } from '@/lib/queries';
import { TravelView } from '@/components/travel/travel-view';

export const metadata: Metadata = { title: 'Travel' };

export default async function TravelPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const canManage = can(session.member.role, 'manage_travel');
  const [trips, members] = session.isDemo
    ? [[], []]
    : await Promise.all([
        getTrips(session.familyId),
        getFamilyMembers(session.familyId).then((ms) => ms.map((m) => ({ id: m.id, name: m.displayName }))),
      ]);

  return <TravelView trips={trips} members={members} live={!session.isDemo} canManage={canManage} />;
}
