import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runWeeklyDigests } from '@/lib/weekly-summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Weekly family digest. Scheduled by Vercel Cron (see vercel.json). Vercel
 * sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is
 * set; we require it so the endpoint can't be triggered by anyone else. Also
 * accepts the app_config cron_secret, matching the reminders job.
 */
async function handle(request: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const auth = request.headers.get('authorization') ?? '';
  const envSecret = process.env.CRON_SECRET;
  let ok = !!envSecret && auth === `Bearer ${envSecret}`;
  if (!ok) {
    const { data } = await admin.from('app_config').select('value').eq('key', 'cron_secret').maybeSingle();
    if (data?.value && auth === `Bearer ${data.value}`) ok = true;
  }
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await runWeeklyDigests(admin);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
