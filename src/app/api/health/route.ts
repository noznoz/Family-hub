import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/env';

// Always run fresh so it reflects the currently-deployed build.
export const dynamic = 'force-dynamic';

/**
 * Public, non-sensitive health/version endpoint. Lets us confirm exactly which
 * build is live (commit + branch) and whether the app is in live or demo mode.
 * Exposes no secrets.
 */
export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  return NextResponse.json({
    ok: true,
    commit: sha.slice(0, 7) || 'unknown',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'unknown',
    mode: isSupabaseConfigured ? 'live' : 'demo',
    time: new Date().toISOString(),
  });
}
