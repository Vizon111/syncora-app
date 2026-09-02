import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { realtimeHub } from '@/lib/realtime/realtime-hub';
import { Sprint } from '@/lib/types';
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
  const projectId = searchParams.get('projectId') || undefined;

  const denied = await requireWorkspaceMember(workspaceId, userId);
  if (denied) return denied;

  const sprints = await db.getSprints(workspaceId, projectId);
  return NextResponse.json({ sprints });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);
  if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  const body = await req.json();
  const { action, workspaceId, sprint, sprintId } = body;

  if (action === 'create') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'task:create');
    if (auth instanceof NextResponse) return auth;

    const newSprint: Sprint = {
      ...sprint,
      id: sprint.id || crypto.randomUUID(),
      workspaceId,
      status: sprint.status || 'draft',
      totalStoryPoints: sprint.totalStoryPoints || 0,
      completedStoryPoints: sprint.completedStoryPoints || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createSprint(newSprint, user);

    realtimeHub.broadcast(workspaceId, {
      id: `evt_sprint_created_${Date.now()}`,
      workspaceId,
      type: 'sprint:created',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: newSprint,
    });

    return NextResponse.json({ sprint: newSprint });
  }

  if (action === 'update') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'task:update');
    if (auth instanceof NextResponse) return auth;

    // Verify the sprint belongs to the authorized workspace before updating,
    // to prevent a member of one workspace from updating another
    // workspace's sprint by supplying its id (IDOR).
    const existingSprint = await db.getSprintById(sprint.id, workspaceId);
    if (!existingSprint) {
      return NextResponse.json({ error: 'Sprint not found in this workspace' }, { status: 404 });
    }

    const updatedSprint: Sprint = {
      ...sprint,
      workspaceId,
      updatedAt: new Date().toISOString(),
    };

    await db.updateSprint(updatedSprint, user);

    realtimeHub.broadcast(workspaceId, {
      id: `evt_sprint_updated_${Date.now()}`,
      workspaceId,
      type: 'sprint:updated',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: updatedSprint,
    });

    return NextResponse.json({ sprint: updatedSprint });
  }

  if (action === 'start') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'task:update');
    if (auth instanceof NextResponse) return auth;

    const targetSprint = await db.startSprint(sprintId, workspaceId, user);
    if (!targetSprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    realtimeHub.broadcast(workspaceId, {
      id: `evt_sprint_started_${Date.now()}`,
      workspaceId,
      type: 'sprint:updated',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: targetSprint,
    });

    return NextResponse.json({ sprint: targetSprint });
  }

  if (action === 'complete') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'task:update');
    if (auth instanceof NextResponse) return auth;

    const targetSprint = await db.completeSprint(sprintId, workspaceId, user);
    if (!targetSprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    realtimeHub.broadcast(workspaceId, {
      id: `evt_sprint_completed_${Date.now()}`,
      workspaceId,
      type: 'sprint:updated',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: targetSprint,
    });

    return NextResponse.json({ sprint: targetSprint });
  }

  if (action === 'delete') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'task:delete');
    if (auth instanceof NextResponse) return auth;

    const deleted = await db.deleteSprint(sprintId, workspaceId, user);
    if (deleted) {
      realtimeHub.broadcast(workspaceId, {
        id: `evt_sprint_del_${Date.now()}`,
        workspaceId,
        type: 'sprint:deleted',
        senderId: user.id,
        senderName: user.name,
        timestamp: Date.now(),
        payload: { sprintId },
      });
    }

    return NextResponse.json({ success: deleted });
  }

  return NextResponse.json({ error: 'Invalid sprint action' }, { status: 400 });
}
