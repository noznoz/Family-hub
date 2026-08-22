import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone, Users, GraduationCap, Settings, ShieldCheck, Bell, LogOut } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getMyProfile } from '@/lib/profile-queries';
import { ROLE_DEFAULTS, PERMISSION_LABELS } from '@/lib/permissions';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import { EditProfileDialog } from '@/components/profile/edit-profile-dialog';
import { signOut } from '../settings/actions';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const session = await getSessionUser();
  if (!session) return null;

  const p = session.isDemo ? null : await getMyProfile(session.memberId);
  const displayName = p?.displayName ?? session.member.displayName;
  const role = (p?.role ?? session.member.role) as keyof typeof ROLE_DEFAULTS;
  const perms = ROLE_DEFAULTS[role] ?? [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Profile</h1>

      {/* Identity */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <AvatarUpload
            memberId={session.memberId}
            familyId={session.familyId}
            name={displayName}
            currentUrl={p?.avatarUrl}
            live={!session.isDemo}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold text-navy">{displayName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Chip tone={role === 'admin' ? 'navy' : 'brand'}>{String(role).replace('_', ' ')}</Chip>
              {p?.relationship && <Chip tone="neutral" className="capitalize">{p.relationship}</Chip>}
              {p?.isStudent && <Chip tone="success">Student</Chip>}
            </div>
          </div>
          <EditProfileDialog displayName={displayName} phone={p?.phone ?? null} live={!session.isDemo} />
        </div>
        {(p?.familyName || p?.memberSince) && (
          <p className="mt-3 text-xs text-muted-foreground">
            {p?.familyName && <>Member of <span className="font-semibold text-navy">{p.familyName}</span></>}
            {p?.memberSince && <> · since {p.memberSince}</>}
          </p>
        )}
      </Card>

      {/* Contact */}
      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Contact</p>
        <Card className="divide-y divide-border">
          <Row icon={<Mail className="size-5" />} label="Email" value={p?.email ?? '—'} />
          <Row icon={<Phone className="size-5" />} label="Phone" value={p?.phone ?? 'Not set'} />
        </Card>
      </div>

      {/* Student card */}
      {p?.student && (
        <div>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Study</p>
          <Card className="divide-y divide-border">
            <Row icon={<GraduationCap className="size-5" />} label="University" value={p.student.university} />
            <Row icon={<Users className="size-5" />} label="Course" value={p.student.course} />
          </Card>
        </div>
      )}

      {/* Permissions */}
      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">What you can do</p>
        <Card className="flex flex-wrap gap-1.5 p-4">
          {perms.length === 0
            ? <span className="text-sm text-muted-foreground">No special permissions.</span>
            : perms.map((perm) => <Chip key={perm} tone="neutral">{PERMISSION_LABELS[perm]}</Chip>)}
        </Card>
      </div>

      {/* Quick links */}
      <Card className="divide-y divide-border">
        <LinkRow href="/settings" icon={<Bell className="size-5" />} label="Notifications & appearance" />
        <LinkRow href="/family" icon={<Users className="size-5" />} label="Family members" />
        <LinkRow href="/settings" icon={<ShieldCheck className="size-5" />} label="Privacy & security" />
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="outline" className="w-full"><LogOut className="size-4" /> Sign out</Button>
      </form>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-navy-400">{icon}</span>
      <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy">{value}</span>
    </div>
  );
}

function LinkRow({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4 hover:bg-muted">
      <span className="text-navy-400">{icon}</span>
      <span className="flex-1 font-semibold text-navy">{label}</span>
      <Settings className="size-4 text-navy-200" />
    </Link>
  );
}
