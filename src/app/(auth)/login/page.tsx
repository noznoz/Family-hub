import type { Metadata } from 'next';
import { isSupabaseConfigured } from '@/lib/env';
import { AppLogo } from '@/components/brand/app-logo';
import { demoMembers } from '@/lib/demo-data';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/chip';
import { AuthForm } from './auth-form';
import { demoLogin } from './actions';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10 safe-top safe-bottom">
      <div className="mb-8 flex flex-col items-center text-center">
        <AppLogo className="size-16" />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-navy">Family Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The private home for Hamza &amp; Omar&apos;s university journey.
        </p>
      </div>

      {isSupabaseConfigured ? (
        <AuthForm />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-brand-muted px-4 py-3 text-sm text-navy">
            <span className="font-semibold">Demo mode.</span> Supabase isn&apos;t connected, so
            pick a family member to explore the app.
          </div>
          <p className="px-1 text-sm font-semibold text-navy">Who are you?</p>
          <div className="grid grid-cols-1 gap-2">
            {demoMembers.map((m) => (
              <form key={m.id} action={demoLogin.bind(null, m.id)}>
                <button type="submit" className="w-full text-left">
                  <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-card-hover">
                    <Avatar name={m.displayName} />
                    <div className="flex-1">
                      <p className="font-semibold text-navy">{m.displayName}</p>
                      <p className="text-xs text-muted-foreground">{m.relationship}</p>
                    </div>
                    <Chip tone={m.role === 'admin' ? 'navy' : m.role === 'parent' ? 'brand' : m.isStudent ? 'success' : 'neutral'}>
                      {m.role.replace('_', ' ')}
                    </Chip>
                  </Card>
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
