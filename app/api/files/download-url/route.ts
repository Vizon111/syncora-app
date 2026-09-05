import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { supabaseAdmin } from '@/lib/db/supabase-client';
import { requireWorkspaceMember } from '@/lib/auth/require-workspace-member';
import { DEMO_WORKSPACE_ID } from '@/lib/db/demo-ids';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { STORAGE_BUCKET } from '@/lib/storage/constants';

/** Returns a short-lived signed URL for downloading a file that was
 *  uploaded to Supabase Storage. Files live in a private bucket (not
 *  publicly readable), so every download must go through this route,
 *  which re-checks that the caller is a member of the file's workspace
 *  before minting the URL — the storage path alone is not a secret a
 *  client should be able to guess-and-fetch. */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get('fileId');
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;
  if (!fileId) return NextResponse.json({ error: 'fileId is required' }, { status: 400 });

  const denied = await requireWorkspaceMember(workspaceId, authUser.id);
  if (denied) return denied;

  const file = await db.getFileById(fileId, workspaceId);
  if (!file || !file.url) {
    return NextResponse.json({ error: 'File not found or has no stored content' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(file.url, 60 * 5); // 5-minute link — enough to open/download, not enough to matter if logged somewhere

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Failed to create signed URL' }, { status: 500 });
  }

  return NextResponse.json({ downloadUrl: data.signedUrl, name: file.name });
}
