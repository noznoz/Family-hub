import type { Metadata } from 'next';
import { AppLogo } from '@/components/brand/app-logo';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/(app)/settings/actions';

export const metadata: Metadata = { title: 'Awaiting approval' };

export default function PendingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center safe-top safe-bottom">
      <AppLogo className="size-14" />
      <h1 className="mt-4 text-xl font-extrabold tracking-tight text-navy">You&apos;re almost in</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Your account was created. A family admin needs to approve your access before you can see the
        family hub. You&apos;ll be able to sign in once they do.
      </p>
      <form action={signOut} className="mt-6 w-full">
        <Button type="submit" variant="outline" className="w-full">Sign out</Button>
      </form>
    </main>
  );
}
