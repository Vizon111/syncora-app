import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { DEMO_WORKSPACE_ID } from '@/lib/db/demo-ids';

/** Lists the caller's own AI Copilot chat sessions for a workspace, most
 *  recently active first. Sessions are private per-user (see migration
 *  0010) — there is no "workspace-wide chat history" here, only "my past
 *  conversations". */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;

  const member = await db.getWorkspaceUser(workspaceId, authUser.id);
  if (!member) return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });

  const sessions = await db.getChatSessions(workspaceId, authUser.id);
  return NextResponse.json({ sessions });
}

/** Creates a new (empty) chat session. The client calls this once, right
 *  before sending the first message of a new conversation, so it has a
 *  sessionId to attach that message to. */
export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspaceId = DEMO_WORKSPACE_ID, title } = body as { workspaceId?: string; title?: string };

  const member = await db.getWorkspaceUser(workspaceId, authUser.id);
  if (!member) return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });

  const session = await db.createChatSession(workspaceId, authUser.id, title);
  return NextResponse.json({ session });
}
