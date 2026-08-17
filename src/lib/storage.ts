'use client';

import { createClient } from '@/lib/supabase/client';
import { env } from '@/lib/env';

/**
 * Upload a file to the private media bucket under the family's folder.
 * The path MUST start with the family id (storage RLS enforces this).
 * Returns the stored object path (without bucket prefix) or null.
 */
export async function uploadMedia(
  familyId: string,
  file: Blob,
  subpath: string,
  contentType?: string,
): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const path = `${familyId}/${subpath}`;
  const { error } = await supabase.storage
    .from(env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET)
    .upload(path, file, { contentType: contentType ?? (file as File).type, upsert: false });
  if (error) {
    console.error('[uploadMedia]', error.message);
    return null;
  }
  return path;
}
