'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';

export async function markAllRead(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const session = await getSessionUser();
  if (!session) return;
  const supabase = await createClient();
  if (!supabase) return;
  await supabase.from('notifications').update({ read_at: new Date().toISOString() })
    .eq('recipient_id', session.memberId).is('read_at', null);
  revalidatePath('/notifications');
}
