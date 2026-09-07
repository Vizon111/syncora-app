import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { getAuthenticatedUser } from '@/lib/supabase/server';

/** Returns all messages in one chat session. Ownership is enforced inside
 *  db.getChatSessionMessages (it returns [] rather than someone else's
 *  messages if the session doesn't belong to the caller), so there's no
 *  separate authorization check needed here beyond "is signed in". */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const messages = await db.getChatSessionMessages(id, authUser.id);
  return NextResponse.json({ messages });
}

/** Renames a chat session (the sidebar's "rename" action). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { title } = body as { title?: string };
  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const session = await db.renameChatSession(id, authUser.id, title.trim().slice(0, 100));
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ session });
}

/** Deletes a chat session. Its messages go with it via ON DELETE CASCADE
 *  on ai_messages.session_id (migration 0010). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const deleted = await db.deleteChatSession(id, authUser.id);
  if (!deleted) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
