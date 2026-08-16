'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/env';
import { DEMO_COOKIE } from '@/lib/session';

/** Extract a readable message from an unknown thrown value (incl. fetch cause). */
function msg(e: unknown): string {
  if (e instanceof Error) {
    const cause = (e as { cause?: { message?: string; code?: string } }).cause;
    const extra = cause?.message || cause?.code;
    return extra ? `${e.message} (${extra})` : e.message;
  }
  return String(e);
}

export async function demoLogin(memberId: string) {
  'use server';
  const store = await cookies();
  store.set(DEMO_COOKIE, memberId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  redirect('/home');
}

export async function signIn(_prev: unknown, formData: FormData) {
  'use server';
  if (!isSupabaseConfigured) return { error: 'Supabase is not configured yet.' };
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase is not configured yet.' };
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
  } catch (e) {
    return { error: `Could not reach Supabase (${msg(e)}). Check the Supabase URL env var in Vercel.` };
  }
  redirect('/welcome');
}

export async function signUp(_prev: unknown, formData: FormData) {
  'use server';
  if (!isSupabaseConfigured) return { error: 'Supabase URL/anon key missing in Vercel.' };
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email and password are required.' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' };

  const admin = createAdminClient();

  // Preferred path: create a pre-confirmed user via the admin API.
  if (admin) {
    try {
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error && !/already been registered|already exists|already registered/i.test(error.message)) {
        // Fall through to normal sign-up on non-duplicate admin errors.
        console.error('[signUp] admin.createUser error:', error.message);
      }
    } catch (e) {
      console.error('[signUp] admin.createUser threw:', msg(e));
      // Fall through to the standard sign-up below.
    }
  }

  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase server client unavailable.' };

  // Try to sign in (works if the admin path created/confirmed the user).
  // Keep redirect() OUT of try/catch — it signals via a thrown control error.
  let signedIn = false;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    signedIn = !error;
  } catch (e) {
    return { error: `Could not reach Supabase (${msg(e)}). Double-check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.` };
  }
  if (signedIn) redirect('/welcome');

  // Fallback: standard sign-up (used if the admin key is absent).
  let created = false;
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.session) {
      return { error: 'Account created, but email confirmation is on. Turn it off in Supabase → Authentication → Providers → Email, then sign in.' };
    }
    created = true;
  } catch (e) {
    return { error: `Could not reach Supabase (${msg(e)}).` };
  }
  if (created) redirect('/welcome');
}
