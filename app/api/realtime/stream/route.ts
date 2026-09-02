import { NextRequest, NextResponse } from 'next/server';
import { realtimeHub } from '@/lib/realtime/realtime-hub';
import { requireWorkspaceMember } from '@/lib/auth/require-workspace-member';
import { DEMO_WORKSPACE_ID } from '@/lib/db/demo-ids';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;

  const denied = await requireWorkspaceMember(workspaceId, userId);
  if (denied) return denied;

  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      unsubscribe = realtimeHub.subscribe(workspaceId, controller);

      // Send initial handshake ping
      const handshake = `data: ${JSON.stringify({ type: 'handshake', status: 'connected', timestamp: Date.now() })}\n\n`;
      controller.enqueue(new TextEncoder().encode(handshake));
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
