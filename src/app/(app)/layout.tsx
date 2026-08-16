import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { Sidebar } from '@/components/nav/sidebar';
import { BottomNav } from '@/components/nav/bottom-nav';
import { AppHeader } from '@/components/nav/app-header';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  // Authenticated but not yet linked to a family member → run onboarding.
  if (!session) redirect('/welcome');

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineIndicator />
        <AppHeader name={session.member.displayName} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-8">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
