import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { realtimeHub } from '@/lib/realtime/realtime-hub';
import { RetroItem } from '@/lib/types';
import { requireWorkspaceMember } from '@/lib/auth/require-workspace-member';
import { DEMO_WORKSPACE_ID } from '@/lib/db/demo-ids';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { authorizeOrDeny } from '@/lib/db/authorize-or-deny';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sprintId } = await params;
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;

  const denied = await requireWorkspaceMember(workspaceId, userId);
  if (denied) return denied;

  const items = await db.getRetroItems(workspaceId, sprintId);
  const summary = await db.getSprintRetroSummary(workspaceId, sprintId);

  return NextResponse.json({ items, summary });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sprintId } = await params;
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);
  if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  const body = await req.json();
  const { workspaceId, item } = body;

  const auth = await authorizeOrDeny(workspaceId, userId, 'task:create');
  if (auth instanceof NextResponse) return auth;

  const newItem: RetroItem = {
    ...item,
    id: item.id || crypto.randomUUID(),
    workspaceId,
    sprintId,
    votes: item.votes || 0,
    votedUserIds: item.votedUserIds || [],
    authorId: user.id,
    authorName: user.name,
    authorAvatar: user.avatar,
    createdAt: new Date().toISOString(),
  };

  await db.createRetroItem(newItem, user);

  realtimeHub.broadcast(workspaceId, {
    id: `evt_retro_created_${Date.now()}`,
    workspaceId,
    type: 'sprint:updated',
    senderId: user.id,
    senderName: user.name,
    timestamp: Date.now(),
    payload: { sprintId, retroItem: newItem },
  });

  return NextResponse.json({ item: newItem });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sprintId } = await params;
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);
  if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;
  const itemId = searchParams.get('itemId');

  if (!itemId) {
    return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
  }

  const auth = await authorizeOrDeny(workspaceId, userId, 'task:delete');
  if (auth instanceof NextResponse) return auth;

  const success = await db.deleteRetroItem(itemId, workspaceId, user);
  if (!success) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  realtimeHub.broadcast(workspaceId, {
    id: `evt_retro_deleted_${Date.now()}`,
    workspaceId,
    type: 'sprint:updated',
    senderId: user.id,
    senderName: user.name,
    timestamp: Date.now(),
    payload: { sprintId, deletedItemId: itemId },
  });

  return NextResponse.json({ success: true });
}
