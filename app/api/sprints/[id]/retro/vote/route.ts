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
  const { workspaceId, itemId } = body;

  if (!itemId || !workspaceId) {
    return NextResponse.json({ error: 'Item ID and workspaceId are required' }, { status: 400 });
  }

  // Tenant authorization check — voting is a mutation and must be scoped to
  // the caller's own workspace membership, same as retro item create/delete
  // in the sibling route.
  const auth = await authorizeOrDeny(workspaceId, userId, 'task:create');
  if (auth instanceof NextResponse) return auth;

  const updatedItem = await db.voteRetroItem(itemId, userId, workspaceId);
  if (!updatedItem) {
    return NextResponse.json({ error: 'Retro item not found' }, { status: 404 });
  }

  realtimeHub.broadcast(workspaceId, {
    id: `evt_retro_voted_${Date.now()}`,
    workspaceId,
    type: 'sprint:updated',
    senderId: user.id,
    senderName: user.name,
    timestamp: Date.now(),
    payload: { sprintId, retroItem: updatedItem },
  });

  return NextResponse.json({ item: updatedItem });
}
