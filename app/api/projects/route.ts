import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { Project } from '@/lib/types';
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

  const denied = await requireWorkspaceMember(workspaceId, userId);
  if (denied) return denied;

  const projects = await db.getProjects(workspaceId);
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = (await db.getUser(userId));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspaceId, name, description, deadline, budget, tags, status } = body;

  const auth = await authorizeOrDeny(workspaceId, userId, 'project:create');
  if (auth instanceof NextResponse) return auth;

  const newProj: Project = {
    id: crypto.randomUUID(),
    workspaceId,
    name: name || 'New Project Initiative',
    description: description || '',
    status: status || 'planning',
    progress: 0,
    budget: budget || '$10,000',
    deadline: deadline || new Date(Date.now() + 30 * 86400000).toISOString(),
    leadId: user.id,
    lead: user,
    memberIds: [user.id],
    tags: tags || ['General'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.createProject(newProj);
  return NextResponse.json({ project: newProj });
}

export async function DELETE(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await db.getUser(authUser.id);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

  const auth = await authorizeOrDeny(workspaceId, authUser.id, 'project:delete');
  if (auth instanceof NextResponse) return auth;

  const deleted = await db.deleteProject(projectId, workspaceId, user);
  if (!deleted) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
