import type { Metadata } from 'next';
import { LogOut, ShieldCheck } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { PERMISSION_LABELS } from '@/lib/permissions';
import { ROLE_DEFAULTS } from '@/lib/permissions';
import { EnableNotifications } from '@/components/pwa/enable-notifications';
import { ThemePicker } from '@/components/settings/theme-picker';
import { signOut } from './actions';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const { member, isDemo } = session;
  const perms = ROLE_DEFAULTS[member.role];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Settings</h1>

      <Card className="flex items-center gap-4 p-5">
        <Avatar name={member.displayName} size="lg" />
        <div className="flex-1">
          <p className="text-lg font-bold text-navy">{member.displayName}</p>
          <Chip tone={member.role === 'admin' ? 'navy' : 'brand'}>{member.role.replace('_', ' ')}</Chip>
        </div>
      </Card>

      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Appearance
        </p>
        <p className="mb-3 px-1 text-xs text-muted-foreground">
          Pick your look — it applies to your account only. Everyone in the family can choose their own.
        </p>
        <ThemePicker />
      </div>

      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Push notifications
        </p>
        <Card className="p-4">
          <EnableNotifications />
        </Card>
      </div>

      <Card className="divide-y divide-border">
        <RowLink icon={<ShieldCheck className="size-5" />} label="Privacy & security" />
      </Card>

      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Your permissions
        </p>
        <Card className="flex flex-wrap gap-1.5 p-4">
          {perms.map((p) => (
            <Chip key={p} tone="neutral">{PERMISSION_LABELS[p]}</Chip>
          ))}
        </Card>
      </div>

      {isDemo && (
        <p className="rounded-xl bg-brand-muted p-3 text-center text-xs text-navy">
          Demo mode — sign out to pick a different family member.
        </p>
      )}

      <form action={signOut}>
        <Button type="submit" variant="outline" className="w-full">
          <LogOut className="size-4" /> Sign out
        </Button>
      </form>
    </div>
  );
}

function RowLink({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-navy-400">{icon}</span>
      <span className="flex-1 font-semibold text-navy">{label}</span>
    </div>
  );
}
