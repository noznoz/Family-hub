'use client';

import { useActionState, useState } from 'react';
import { signIn, signUp } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Mode = 'signin' | 'signup';

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('signup');
  const action = mode === 'signup' ? signUp : signIn;
  const [state, formAction, pending] = useActionState(action, null as { error?: string } | null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={cn('rounded-lg py-2 text-sm font-semibold transition-colors', mode === 'signup' ? 'bg-white text-navy shadow-sm' : 'text-muted-foreground')}
        >
          Create account
        </button>
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={cn('rounded-lg py-2 text-sm font-semibold transition-colors', mode === 'signin' ? 'bg-white text-navy shadow-sm' : 'text-muted-foreground')}
        >
          Sign in
        </button>
      </div>

      <form action={formAction} className="space-y-3">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-semibold text-navy">Email</label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-semibold text-navy">Password</label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
          />
        </div>
        {state?.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
        <Button type="submit" variant="brand" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Please wait…' : mode === 'signup' ? 'Create account & continue' : 'Sign in'}
        </Button>
      </form>

      {mode === 'signup' && (
        <p className="px-1 text-center text-xs text-muted-foreground">
          The first account becomes the family admin.
        </p>
      )}
    </div>
  );
}
