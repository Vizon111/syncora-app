import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { FileItem } from '@/lib/types';
import { requireWorkspaceMember } from '@/lib/auth/require-workspace-member';
import { DEMO_WORKSPACE_ID } from '@/lib/db/demo-ids';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { authorizeOrDeny } from '@/lib/db/authorize-or-deny';

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;

  const denied = await requireWorkspaceMember(workspaceId, userId);
  if (denied) return denied;

  const files = await db.getFiles(workspaceId);
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);
  if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  const body = await req.json();
  const { action, workspaceId, file, fileId } = body;

  if (action === 'upload') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'file:upload');
    if (auth instanceof NextResponse) return auth;

    const newFile: FileItem = {
      id: crypto.randomUUID(),
      workspaceId,
      projectId: file.projectId,
      name: file.name,
      size: file.size || 1024 * 50,
      type: file.type || 'text/plain',
      extractedText: file.extractedText || `Extracted text contents of file ${file.name} for Flowspace RAG index.`,
      isIndexedForRag: true,
      uploadedById: user.id,
      uploadedBy: user,
      createdAt: new Date().toISOString(),
    };

    await db.addFile(newFile, user);
    return NextResponse.json({ file: newFile });
  }

  if (action === 'delete') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'file:delete');
    if (auth instanceof NextResponse) return auth;

    const deleted = await db.deleteFile(fileId, workspaceId, user);
    return NextResponse.json({ success: deleted });
  }

  return NextResponse.json({ error: 'Invalid file action' }, { status: 400 });
}
