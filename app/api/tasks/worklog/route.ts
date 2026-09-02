import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { realtimeHub } from '@/lib/realtime/realtime-hub';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { authorizeOrDeny } from '@/lib/db/authorize-or-deny';

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);
  if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  const body = await req.json();
  const { action, workspaceId, taskId, worklog, worklogId } = body;

  if (!workspaceId || !taskId) {
    return NextResponse.json({ error: 'workspaceId and taskId are required' }, { status: 400 });
  }

  const auth = await authorizeOrDeny(workspaceId, userId, 'task:update');
  if (auth instanceof NextResponse) return auth;

  if (action === 'log') {
    if (!worklog || !worklog.hours || Number(worklog.hours) <= 0) {
      return NextResponse.json({ error: 'Valid hours (> 0) is required' }, { status: 400 });
    }

    const result = await db.logWorkTime(taskId, workspaceId, worklog, user);
    if (!result) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    realtimeHub.broadcast(workspaceId, {
      id: `evt_task_worklog_${Date.now()}`,
      workspaceId,
      type: 'task:updated',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: result.task,
    });

    return NextResponse.json(result);
  }

  if (action === 'delete') {
    if (!worklogId) {
      return NextResponse.json({ error: 'worklogId is required' }, { status: 400 });
    }

    const updatedTask = await db.deleteWorklog(taskId, worklogId, workspaceId, user);
    if (!updatedTask) {
      return NextResponse.json({ error: 'Task or worklog not found' }, { status: 404 });
    }

    realtimeHub.broadcast(workspaceId, {
      id: `evt_task_worklog_del_${Date.now()}`,
      workspaceId,
      type: 'task:updated',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: updatedTask,
    });

    return NextResponse.json({ task: updatedTask });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
