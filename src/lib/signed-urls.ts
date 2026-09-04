import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

const MEDIA = env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET;
const DOCS = env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET;
const TTL_SECONDS = 3600;

/** Some rows store the bucket name as a prefix; storage expects it stripped. */
function normalise(path: string, bucket: string): string {
  return path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
}

/** Seeded placeholder paths point at nothing — never try to sign them. */
function usable(path: string | null | undefined): path is string {
  return !!path && !path.startsWith('media/placeholder');
}

/**
 * Sign many private objects in ONE request and return a map keyed by the
 * original (un-normalised) path. Falls back to an empty map on failure so a
 * signing problem degrades to "no image" instead of breaking the page.
 */
async function signBatch(
  paths: (string | null | undefined)[],
  bucket: string,
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter(usable))];
  const out = new Map<string, string>();
  if (wanted.length === 0) return out;
  try {
    const supabase = await createClient();
    if (!supabase) return out;
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(wanted.map((p) => normalise(p, bucket)), TTL_SECONDS);
    if (error || !data) {
      if (error) console.error('[signed-urls]', bucket, error.message);
      return out;
    }
    data.forEach((row, i) => {
      const original = wanted[i];
      if (original && row?.signedUrl) out.set(original, row.signedUrl);
    });
  } catch (e) {
    console.error('[signed-urls]', bucket, e instanceof Error ? e.message : String(e));
  }
  return out;
}

/** Batch-sign objects in the private media bucket (photos, receipts, avatars). */
export function signMediaMany(paths: (string | null | undefined)[]) {
  return signBatch(paths, MEDIA);
}

/** Batch-sign objects in the private documents bucket. */
export function signDocsMany(paths: (string | null | undefined)[]) {
  return signBatch(paths, DOCS);
}

/** Sign a single media object. */
export async function signMedia(path: string | null | undefined): Promise<string | null> {
  if (!usable(path)) return null;
  return (await signMediaMany([path])).get(path) ?? null;
}

/** Sign a single document object. */
export async function signDoc(path: string | null | undefined): Promise<string | null> {
  if (!usable(path)) return null;
  return (await signDocsMany([path])).get(path) ?? null;
}
