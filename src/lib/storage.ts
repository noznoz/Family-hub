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

/** Upload a document to the private documents bucket under the family folder. */
export async function uploadDocument(
  familyId: string,
  file: File,
  subpath: string,
): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const path = `${familyId}/${subpath}`;
  const { error } = await supabase.storage
    .from(env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error('[uploadDocument]', error.message);
    return null;
  }
  return path;
}
