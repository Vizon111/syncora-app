import { NextRequest, NextResponse } from 'next/server';
import { realtimeHub } from '@/lib/realtime/realtime-hub';
import { RealtimeEvent } from '@/lib/types';
import { db } from '@/lib/db/storage';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { requireWorkspaceMember } from '@/lib/auth/require-workspace-member';

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);
  if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  const body = (await req.json()) as RealtimeEvent;
  const { workspaceId, type, payload } = body;

  if (!workspaceId || !type) {
    return NextResponse.json({ error: 'Invalid event payload' }, { status: 400 });
  }

  // Tenant authorization check — only members of the workspace may publish
  // events into it. This also stops a caller from broadcasting into (or
  // reading presence for) a workspace they don't belong to.
  const denied = await requireWorkspaceMember(workspaceId, userId);
  if (denied) return denied;

  // Never trust client-supplied sender identity — it can be used to spoof
  // messages/presence as another user. Always stamp the verified caller.
  const senderId = user.id;
  const senderName = user.name;

  if (type === 'presence:update') {
    realtimeHub.updatePresence(workspaceId, { ...payload, userId: senderId, name: senderName });
    return NextResponse.json({ success: true });
  }

  // Broadcast to all active SSE subscribers in this workspace
  realtimeHub.broadcast(workspaceId, {
    id: body.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    workspaceId,
    type,
    senderId,
    senderName,
    timestamp: Date.now(),
    payload,
  });

  return NextResponse.json({ success: true });
}
