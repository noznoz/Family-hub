import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ensureMembership } from '@/lib/actions/onboarding';
import { AppLogo } from '@/components/brand/app-logo';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/(app)/settings/actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Setting up' };

/** Post-auth bootstrap: make the first user an admin, then route them in.
 *  On error we render a page (never redirect back to a route that returns
 *  here) so a failure can't become an infinite redirect loop. */
export default async function WelcomePage() {
  const result = await ensureMembership();
  if (result === 'admin' || result === 'active') redirect('/home');
  if (result === 'pending') redirect('/pending');
  if (result === 'unauthenticated') redirect('/login');

  // result === 'error' → show a recoverable screen
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center safe-top safe-bottom">
      <AppLogo className="size-14" />
      <h1 className="mt-4 text-xl font-extrabold tracking-tight text-navy">Almost there</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        We couldn&apos;t finish setting up your account just now. This is usually a brief hiccup —
        tap Try again.
      </p>
      <a href="/welcome" className="mt-6 w-full">
        <Button variant="brand" className="w-full">Try again</Button>
      </a>
      <form action={signOut} className="mt-2 w-full">
        <Button type="submit" variant="ghost" className="w-full">Sign out</Button>
      </form>
    </main>
  );
}
