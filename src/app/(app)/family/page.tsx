import type { Metadata } from 'next';
import { Settings2 } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getFamilyMembers } from '@/lib/queries';
import { demoMembers } from '@/lib/demo-data';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/chip';
import { AddMemberDialog } from '@/components/family/add-member-dialog';

export const metadata: Metadata = { title: 'Family' };

export default async function FamilyPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const canManage = can(session.member.role, 'manage_family_members');

  const members = session.isDemo ? demoMembers : await getFamilyMembers(session.familyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Family</h1>
        {canManage && <AddMemberDialog live={!session.isDemo} />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <Card key={m.id} className="flex items-center gap-3 p-4">
            <Avatar name={m.displayName} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-navy">{m.displayName}</p>
              <p className="text-sm capitalize text-muted-foreground">{m.relationship}</p>
              <div className="mt-1.5">
                <Chip tone={m.role === 'admin' ? 'navy' : m.role === 'parent' ? 'brand' : m.isStudent ? 'success' : 'neutral'}>
                  {m.role.replace('_', ' ')}
                </Chip>
              </div>
            </div>
            {canManage && (
              <button aria-label={`Configure ${m.displayName}`} className="rounded-lg p-2 text-navy-300 hover:bg-muted hover:text-navy">
                <Settings2 className="size-5" />
              </button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
