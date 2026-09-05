import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { requireWorkspaceMember } from '@/lib/auth/require-workspace-member';
import { DEMO_WORKSPACE_ID } from '@/lib/db/demo-ids';
import { getAuthenticatedUser } from '@/lib/supabase/server';

/** Returns the portal link for a project, if one exists (null if it hasn't
 *  been generated yet — the UI shows a "Generate link" button in that case
 *  rather than treating this as an error). */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

  const denied = await requireWorkspaceMember(workspaceId, authUser.id);
  if (denied) return denied;

  const link = await db.getPortalLinkForProject(projectId, workspaceId);
  return NextResponse.json({ link });
}

/** Creates a portal link for a project (idempotent — see
 *  db.createPortalLink) or toggles an existing one on/off, depending on
 *  the request body. Requires the caller to at least be a workspace
 *  member; unlike task/document mutations this doesn't gate on a specific
 *  RBAC permission, since sharing a project externally is closer to a
 *  personal workflow choice than a data-mutation the whole team needs
 *  control over — any member who can see the project can generate a link
 *  to it. */
export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { projectId, workspaceId = DEMO_WORKSPACE_ID, isEnabled } = body as {
    projectId?: string;
    workspaceId?: string;
    isEnabled?: boolean;
  };
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

  const denied = await requireWorkspaceMember(workspaceId, authUser.id);
  if (denied) return denied;

  const project = await db.getProjectById(projectId, workspaceId);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  if (typeof isEnabled === 'boolean') {
    const link = await db.setPortalLinkEnabled(projectId, workspaceId, isEnabled);
    return NextResponse.json({ link });
  }

  const link = await db.createPortalLink(projectId, workspaceId, authUser.id);
  return NextResponse.json({ link });
}
