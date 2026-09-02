import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = authUser.id;
  const user = await db.getUser(userId);

  // Only return workspaces this user is actually a member of, and only
  // users who share at least one of those workspaces with them (the
  // frontend needs this list to populate assignee pickers, team views, etc.
  // across all of the user's workspaces, since this endpoint runs before
  // any specific workspace is selected). Tenant isolation for both queries
  // is now enforced in lib/db/storage.ts via getWorkspacesForUser /
  // getCoMemberUsers, which join through workspace_members.
  const workspaces = await db.getWorkspacesForUser(userId);
  const allUsers = await db.getCoMemberUsers(userId);

  return NextResponse.json({
    user,
    allUsers,
    workspaces,
  });
}

// POST previously supported a `switch_user` / `create_user` demo flow that
// let the client impersonate any user without a password — removed along
// with the rest of the demo persona switcher (see hooks/use-workspace-context.tsx)
// now that real sign-up/sign-in/sign-out goes through Supabase Auth
// (app/login, app/signup, and supabase.auth.signOut() respectively).
