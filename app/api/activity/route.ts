import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { requireWorkspaceMember } from '@/lib/auth/require-workspace-member';
import { DEMO_WORKSPACE_ID } from '@/lib/db/demo-ids';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const denied = await requireWorkspaceMember(workspaceId, userId);
  if (denied) return denied;

  const activities = await db.getActivities(workspaceId, limit);
  return NextResponse.json({ activities });
}
