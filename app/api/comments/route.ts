import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { realtimeHub } from '@/lib/realtime/realtime-hub';
import { Comment } from '@/lib/types';
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
  const targetType = searchParams.get('targetType') || undefined;
  const targetId = searchParams.get('targetId') || undefined;

  const denied = await requireWorkspaceMember(workspaceId, userId);
  if (denied) return denied;

  const comments = await db.getComments(workspaceId, targetType, targetId);
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);
  if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  const body = await req.json();
  const { action, workspaceId, comment, commentId, replyContent, resolved } = body;

  if (action === 'create') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'comment:create');
    if (auth instanceof NextResponse) return auth;

    const newComment: Comment = {
      id: crypto.randomUUID(),
      workspaceId,
      targetType: comment.targetType,
      targetId: comment.targetId,
      authorId: user.id,
      author: user,
      content: comment.content,
      resolved: false,
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.addComment(newComment, user);

    realtimeHub.broadcast(workspaceId, {
      id: `evt_cmt_${Date.now()}`,
      workspaceId,
      type: 'comment:created',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: newComment,
    });

    return NextResponse.json({ comment: newComment });
  }

  if (action === 'reply') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'comment:create');
    if (auth instanceof NextResponse) return auth;

    const updated = await db.addCommentReply(commentId, workspaceId, { content: replyContent }, user);
    if (!updated) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    realtimeHub.broadcast(workspaceId, {
      id: `evt_cmt_reply_${Date.now()}`,
      workspaceId,
      type: 'comment:created',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: updated,
    });

    return NextResponse.json({ comment: updated });
  }

  if (action === 'resolve') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'comment:resolve');
    if (auth instanceof NextResponse) return auth;

    const updated = await db.resolveComment(commentId, workspaceId, user, resolved ?? true);
    if (!updated) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

    realtimeHub.broadcast(workspaceId, {
      id: `evt_cmt_res_${Date.now()}`,
      workspaceId,
      type: 'comment:resolved',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: updated,
    });

    return NextResponse.json({ comment: updated });
  }

  return NextResponse.json({ error: 'Invalid comment action' }, { status: 400 });
}
