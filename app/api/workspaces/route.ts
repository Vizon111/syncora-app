import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { Workspace } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { authorizeOrDeny } from '@/lib/db/authorize-or-deny';

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;

  // Only return workspaces the user actually belongs to — enforced in
  // lib/db/storage.ts via getWorkspacesForUser, which joins through
  // workspace_members rather than trusting a client-supplied filter.
  const list = await db.getWorkspacesForUser(userId);
  return NextResponse.json({ workspaces: list });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action, name, slug, avatar, workspaceId, inviteEmail, role } = body;

  if (action === 'create_workspace') {
    const wsId = crypto.randomUUID();
    const newWs: Workspace = {
      id: wsId,
      name: name || 'New Squad Workspace',
      slug: slug || `squad-${Date.now().toString(36)}`,
      avatar: avatar || '⚡',
      ownerId: user.id,
      plan: 'pro',
      createdAt: new Date().toISOString(),
      membersCount: 1,
    };

    await db.createWorkspace(newWs, 'owner');

    await db.logActivity({
      id: crypto.randomUUID(),
      workspaceId: wsId,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      userRole: 'owner',
      action: 'user_joined',
      targetType: 'workspace',
      targetId: wsId,
      targetName: newWs.name,
      details: 'Created and provisioned new multi-tenant workspace',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ workspace: newWs });
  }

  if (action === 'invite_member') {
    const auth = await authorizeOrDeny(workspaceId, userId, 'workspace:invite');
    if (auth instanceof NextResponse) return auth;

    let invitedUser = await db.getUserByEmail(inviteEmail);
    if (!invitedUser) {
      // Creates a real auth.users row (person receives an email to set a
      // password) — see the doc comment on inviteUserByEmail() for why this
      // can't just be a public.users insert.
      invitedUser = await db.inviteUserByEmail(inviteEmail, inviteEmail.split('@')[0]);
    }

    await db.addWorkspaceMember(workspaceId, invitedUser.id, role || 'member');

    await db.logActivity({
      id: crypto.randomUUID(),
      workspaceId,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      userRole: auth.member.role,
      action: 'user_joined',
      targetType: 'workspace',
      targetId: workspaceId,
      targetName: invitedUser.name,
      details: `Invited ${invitedUser.email} with role ${role || 'member'}`,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, member: invitedUser });
  }

  return NextResponse.json({ error: 'Invalid workspace action' }, { status: 400 });
}
