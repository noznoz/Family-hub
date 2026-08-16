'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase is not configured yet.' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect('/welcome');
}

export async function signUp(_prev: unknown, formData: FormData) {
  'use server';
  if (!isSupabaseConfigured) return { error: 'Supabase is not configured yet.' };
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email and password are required.' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' };

  const admin = createAdminClient();
  if (!admin) return { error: 'Backend is not fully configured (missing service role key).' };

  // Create a confirmed user (no email verification step needed).
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr && !/already been registered|already exists/i.test(createErr.message)) {
    return { error: createErr.message };
  }

  // Sign them in to establish the session.
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase is not configured yet.' };
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    return { error: 'Account exists. Try signing in instead, or check your password.' };
  }

  redirect('/welcome');
}
