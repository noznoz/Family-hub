'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { DEMO_COOKIE } from '@/lib/session';

export async function demoLogin(memberId: string) {
  'use server';
  const store = await cookies();
  store.set(DEMO_COOKIE, memberId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect('/home');
}

export async function signIn(_prev: unknown, formData: FormData) {
  'use server';
  if (!isSupabaseConfigured) return { error: 'Supabase is not configured yet.' };
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase is not configured yet.' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect('/home');
}
