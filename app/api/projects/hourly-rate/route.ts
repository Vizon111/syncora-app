import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { authorizeOrDeny } from '@/lib/db/authorize-or-deny';
import { getAuthenticatedUser } from '@/lib/supabase/server';

/** Sets (or clears) a project's hourly billing rate, used by the
 *  Time-to-Invoice feature to convert logged worklog hours into a PDF
 *  invoice. Deliberately its own narrow route rather than a general
 *  project-update endpoint — updateProject() in storage.ts exists but
 *  isn't wired to any route yet, and adding a full PATCH surface for
 *  every project field is a separate concern from billing. */
export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { projectId, workspaceId, hourlyRate } = body as {
    projectId?: string;
    workspaceId?: string;
    hourlyRate?: number | null;
  };
  if (!projectId || !workspaceId) {
    return NextResponse.json({ error: 'projectId and workspaceId are required' }, { status: 400 });
  }
  if (hourlyRate !== null && hourlyRate !== undefined && (typeof hourlyRate !== 'number' || hourlyRate < 0)) {
    return NextResponse.json({ error: 'hourlyRate must be a non-negative number or null' }, { status: 400 });
  }

  const auth = await authorizeOrDeny(workspaceId, authUser.id, 'project:update');
  if (auth instanceof NextResponse) return auth;

  const project = await db.getProjectById(projectId, workspaceId);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const updated = await db.updateProject({ ...project, hourlyRate: hourlyRate ?? undefined });
  return NextResponse.json({ project: updated });
}
