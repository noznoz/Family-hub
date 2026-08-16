import { z } from 'zod';

/**
 * Environment validation. Public vars are optional at build time so the app
 * can compile and render a graceful "connect Supabase" state, but they are
 * required for real data access at runtime.
 */
const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_PRODUCTION_DOMAIN: z.string().optional().default(''),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_DOCS_BUCKET: z.string().default('documents'),
  NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET: z.string().default('media'),
});

export const env = schema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_PRODUCTION_DOMAIN: process.env.NEXT_PUBLIC_PRODUCTION_DOMAIN,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_DOCS_BUCKET: process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET,
  NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET: process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET,
});

/** True when a real Supabase backend is configured. */
export const isSupabaseConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
