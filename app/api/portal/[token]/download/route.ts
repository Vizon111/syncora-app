import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { supabaseAdmin } from '@/lib/db/supabase-client';
import { STORAGE_BUCKET } from '@/lib/storage/constants';

/** Public, token-gated file download for the client portal. Re-validates
 *  the portal token (not just "any authenticated user", since there is no
 *  authenticated user here) and confirms the requested file actually
 *  belongs to that token's project before minting a signed URL — a client
 *  with one project's portal link can't use it to fish for another
 *  project's files by guessing fileIds. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get('fileId');
  if (!token || !fileId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const portalData = await db.getPortalDataByToken(token);
  if (!portalData) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fileBelongsToProject = portalData.files.some((f) => f.id === fileId);
  if (!fileBelongsToProject) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const file = await db.getFileByIdUnscoped(fileId);
  if (!file || !file.url) {
    return NextResponse.json({ error: 'File has no stored content' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(file.url, 60 * 5);

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Failed to create signed URL' }, { status: 500 });
  }

  return NextResponse.json({ downloadUrl: data.signedUrl, name: file.name });
}
