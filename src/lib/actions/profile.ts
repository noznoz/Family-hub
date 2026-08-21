'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';

type Result = { ok: true } | { ok: false; error: string };

export interface ProfileInput {
  displayName: string;
  phone?: string;
}

/** Update the signed-in member's own name and phone. */
export async function updateMyProfile(input: ProfileInput): Promise<Result> {
  if (!input.displayName.trim()) return { ok: false, error: 'Name is required.' };
  if (!isSupabaseConfigured) return { ok: true };

  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Backend unavailable.' };
  const { data: { user } } = await supabase.auth.getUser();

  const { error: mErr } = await supabase
    .from('family_members')
    .update({ display_name: input.displayName.trim() })
    .eq('id', session.memberId);
  if (mErr) return { ok: false, error: mErr.message };

  if (user?.id) {
    await supabase
      .from('profiles')
      .update({ full_name: input.displayName.trim(), phone: input.phone?.trim() || null })
      .eq('id', user.id);
  }

  revalidatePath('/profile');
  revalidatePath('/settings');
  return { ok: true };
}
