import { redirect } from 'next/navigation';
import { ensureMembership } from '@/lib/actions/onboarding';

export const dynamic = 'force-dynamic';

/** Post-auth bootstrap: make the first user an admin, then route them in. */
export default async function WelcomePage() {
  const result = await ensureMembership();
  if (result === 'unauthenticated' || result === 'error') redirect('/login');
  if (result === 'pending') redirect('/pending');
  redirect('/home');
}
