import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';

/** Public, token-gated endpoint — deliberately reachable without a
 *  Supabase Auth session. The token in the URL is the credential; see
 *  db.getPortalDataByToken for exactly what's returned (a narrow,
 *  client-safe summary) and supabase/migrations/0008 for why the token is
 *  unguessable. An unknown or disabled token gets the same generic 404 so
 *  a caller can't distinguish "never existed" from "was turned off". */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data = await db.getPortalDataByToken(token);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(data);
}
