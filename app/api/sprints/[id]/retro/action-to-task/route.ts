import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { realtimeHub } from '@/lib/realtime/realtime-hub';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { authorizeOrDeny } from '@/lib/db/authorize-or-deny';

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
  const { workspaceId, itemId, targetSprintId } = body;

  if (!itemId || !workspaceId) {
    return NextResponse.json({ error: 'Item ID and workspaceId are required' }, { status: 400 });
  }

  const auth = await authorizeOrDeny(workspaceId, userId, 'task:create');
  if (auth instanceof NextResponse) return auth;

  const result = await db.convertRetroActionToTask(itemId, workspaceId, targetSprintId || null, user);
  if (!result) {
    return NextResponse.json({ error: 'Retro item not found or could not be converted' }, { status: 404 });
  }

  // Broadcast both task created and retro item updated
  realtimeHub.broadcast(workspaceId, {
    id: `evt_task_created_${Date.now()}`,
    workspaceId,
    type: 'task:created',
    senderId: user.id,
    senderName: user.name,
    timestamp: Date.now(),
    payload: result.task,
  });

  realtimeHub.broadcast(workspaceId, {
    id: `evt_retro_converted_${Date.now()}`,
    workspaceId,
    type: 'sprint:updated',
    senderId: user.id,
    senderName: user.name,
    timestamp: Date.now(),
    payload: { sprintId, retroItem: result.retroItem, newTask: result.task },
  });

  return NextResponse.json(result);
}
