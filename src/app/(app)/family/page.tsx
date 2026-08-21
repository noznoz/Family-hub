import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getFamilyMembers } from '@/lib/queries';
import { demoMembers } from '@/lib/demo-data';
import { AddMemberDialog } from '@/components/family/add-member-dialog';
import { FamilyMembers } from '@/components/family/family-members';

export const metadata: Metadata = { title: 'Family' };

export default async function FamilyPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const canManage = can(session.member.role, 'manage_family_members', session.overrides);
  const members = session.isDemo ? demoMembers : await getFamilyMembers(session.familyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Family</h1>
        {canManage && <AddMemberDialog live={!session.isDemo} />}
      </div>
      <FamilyMembers members={members} canManage={canManage} />
    </div>
  );
}
