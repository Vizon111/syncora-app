import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { realtimeHub } from '@/lib/realtime/realtime-hub';
import { Task } from '@/lib/types';
import { requireWorkspaceMember } from '@/lib/auth/require-workspace-member';
import { DEMO_WORKSPACE_ID } from '@/lib/db/demo-ids';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { authorizeOrDeny } from '@/lib/db/authorize-or-deny';

// Always derive `assignee` from `assigneeId` server-side, rather than trusting
// whatever object the client sent. This also correctly clears `assignee` when
// assigneeId is unset (unassigning a task) instead of leaving a stale user
// object behind.
async function updatedTaskAssignee(assigneeId: string | undefined) {
  return assigneeId ? await db.getUser(assigneeId) : undefined;
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;
  const projectId = searchParams.get('projectId') || undefined;

  const denied = await requireWorkspaceMember(workspaceId, userId);
  if (denied) return denied;

  const tasks = await db.getTasks(workspaceId, projectId);
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);
  if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  const body = await req.json();
  const { action, workspaceId, task } = body;

  if (action === 'create') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'task:create');
    if (auth instanceof NextResponse) return auth;

    const newTask: Task = {
      ...task,
      id: task.id || crypto.randomUUID(),
      workspaceId,
      reporterId: user.id,
      reporter: user,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignee: await updatedTaskAssignee(task.assigneeId),
    };

    await db.createTask(newTask, user);

    // Broadcast realtime event
    realtimeHub.broadcast(workspaceId, {
      id: `evt_task_created_${Date.now()}`,
      workspaceId,
      type: 'task:created',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: newTask,
    });

    return NextResponse.json({ task: newTask });
  }

  if (action === 'update') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'task:update');
    if (auth instanceof NextResponse) return auth;

    // Verify the task being updated actually belongs to the authorized
    // workspace. Without this check, a member of one workspace could update
    // a task belonging to a different workspace just by supplying its id
    // (IDOR) while passing their own, legitimate workspaceId for the auth
    // check above.
    const existingTask = await db.getTaskById(task.id, workspaceId);
    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found in this workspace' }, { status: 404 });
    }

    const updatedTask: Task = {
      ...task,
      workspaceId,
      updatedAt: new Date().toISOString(),
      assignee: await updatedTaskAssignee(task.assigneeId),
    };

    await db.updateTask(updatedTask, user);

    realtimeHub.broadcast(workspaceId, {
      id: `evt_task_updated_${Date.now()}`,
      workspaceId,
      type: 'task:updated',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: updatedTask,
    });

    return NextResponse.json({ task: updatedTask });
  }

  if (action === 'delete') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'task:delete');
    if (auth instanceof NextResponse) return auth;

    const { taskId } = body;
    const deleted = await db.deleteTask(taskId, workspaceId, user);

    if (deleted) {
      realtimeHub.broadcast(workspaceId, {
        id: `evt_task_del_${Date.now()}`,
        workspaceId,
        type: 'task:deleted',
        senderId: user.id,
        senderName: user.name,
        timestamp: Date.now(),
        payload: { taskId },
      });
    }

    return NextResponse.json({ success: deleted });
  }

  return NextResponse.json({ error: 'Invalid task action' }, { status: 400 });
}
