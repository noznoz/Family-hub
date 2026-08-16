'use client';

import { useActionState } from 'react';
import { signIn } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, null as { error?: string } | null);
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-semibold text-navy">Email</label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold text-navy">Password</label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
      </div>
      {state?.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
