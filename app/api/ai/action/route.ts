import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { realtimeHub } from '@/lib/realtime/realtime-hub';
import { Task } from '@/lib/types';
import { checkAiRateLimit } from '@/lib/ai/rate-limit';
import { DEMO_PROJECT_ID } from '@/lib/db/demo-ids';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { authorizeOrDeny } from '@/lib/db/authorize-or-deny';

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);
  if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

  const body = await req.json();
  const { workspaceId, proposal } = body;

  const auth = await authorizeOrDeny(workspaceId, userId, 'ai:execute_action');
  if (auth instanceof NextResponse) return auth;

  const rateLimit = await checkAiRateLimit(userId, 30);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many AI action requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  if (proposal.type === 'create_task') {
    const payload = proposal.payload;
    const newTask: Task = {
      id: crypto.randomUUID(),
      workspaceId,
      projectId: payload.projectId || DEMO_PROJECT_ID,
      title: payload.title || 'AI Generated Task',
      description: payload.description || 'Task created via verified Flowspace AI Action.',
      status: payload.status || 'todo',
      priority: payload.priority || 'medium',
      assigneeId: payload.assigneeId,
      assignee: payload.assigneeId ? (await db.getUser(payload.assigneeId)) ?? undefined : undefined,
      reporterId: user.id,
      reporter: user,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      labels: ['AI-Generated', ...(payload.labels || [])],
      commentsCount: 0,
      order: 99,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createTask(newTask, user);

    realtimeHub.broadcast(workspaceId, {
      id: `evt_task_ai_${Date.now()}`,
      workspaceId,
      type: 'task:created',
      senderId: user.id,
      senderName: user.name,
      timestamp: Date.now(),
      payload: newTask,
    });

    return NextResponse.json({ success: true, result: newTask, message: `Задача "${newTask.title}" успешно создана!` });
  }

  return NextResponse.json({ error: 'Unsupported action type' }, { status: 400 });
}
