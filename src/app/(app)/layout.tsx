import { getSessionUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/nav/sidebar';
import { BottomNav } from '@/components/nav/bottom-nav';
import { AppHeader } from '@/components/nav/app-header';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { AppLogo } from '@/components/brand/app-logo';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/(app)/settings/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();

  if (!session) {
    // Are we even signed in? If not, go to login. If signed in but unlinked,
    // show a recoverable screen — never an infinite redirect/spinner.
    const supabase = await createClient();
    const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    if (!user) redirect('/login');
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center safe-top safe-bottom">
        <AppLogo className="size-14" />
        <h1 className="mt-4 text-xl font-extrabold tracking-tight text-navy">We couldn&apos;t load your account</h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          You&apos;re signed in, but we couldn&apos;t match you to a family member. Try finishing
          setup, or sign out and back in.
        </p>
        <a href="/welcome" className="mt-6 w-full"><Button variant="brand" className="w-full">Finish setup</Button></a>
        <form action={signOut} className="mt-2 w-full"><Button type="submit" variant="ghost" className="w-full">Sign out</Button></form>
      </main>
    );
  }

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
