import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const publicKey = await getVapidPublicKey();
  if (!publicKey) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  return NextResponse.json({ publicKey });
}
