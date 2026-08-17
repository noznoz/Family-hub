import { z } from 'zod';

/**
 * Environment validation. Public vars are optional so the app can build and
 * render a graceful "connect Supabase" state, but they are required for real
 * data access at runtime.
 *
 * Resilience: empty strings (a common result of an env var added with no value)
 * are treated as "unset", and any malformed value falls back to a safe default
 * via .catch() so a single bad env var can never fail the production build.
 */
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional()).catch(undefined);
const optionalStr = z.preprocess(emptyToUndefined, z.string().min(1).optional()).catch(undefined);

const schema = z.object({
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_PRODUCTION_DOMAIN: optionalUrl,
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalStr,
  NEXT_PUBLIC_SUPABASE_DOCS_BUCKET: optionalStr,
  NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET: optionalStr,
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_PRODUCTION_DOMAIN: process.env.NEXT_PUBLIC_PRODUCTION_DOMAIN,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_DOCS_BUCKET: process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET,
  NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET: process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET,
});

const raw = parsed.success ? parsed.data : {};

/** Strip trailing slashes so `${url}/auth/...` never becomes a double slash. */
const trimSlash = (v: string | undefined) => v?.replace(/\/+$/, '');

export const env = {
  NEXT_PUBLIC_APP_URL: trimSlash(raw.NEXT_PUBLIC_APP_URL) ?? 'http://localhost:3000',
  NEXT_PUBLIC_PRODUCTION_DOMAIN: trimSlash(raw.NEXT_PUBLIC_PRODUCTION_DOMAIN) ?? '',
  NEXT_PUBLIC_SUPABASE_URL: trimSlash(raw.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_DOCS_BUCKET: raw.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET ?? 'documents',
  NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET: raw.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET ?? 'media',
};

/** True when a real Supabase backend is configured. */
export const isSupabaseConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
