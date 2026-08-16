'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { DEMO_COOKIE } from '@/lib/session';

export async function signOut() {
  'use server';
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase?.auth.signOut();
  }
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  redirect('/login');
}
