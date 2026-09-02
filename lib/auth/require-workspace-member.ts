import { NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';

/**
 * Verifies that `userId` is a member of `workspaceId` before allowing a read
 * (GET) request to proceed. Every GET route in this project previously
 * skipped this check entirely: filtering data by `workspaceId` alone is not
 * an authorization check, since any caller can simply pass a different
 * workspace's id and read its data.
 *
 * Unlike `db.authorize`, this does not check a specific permission (like
 * `task:update`) — it only confirms tenant membership, which is the right
 * bar for read access. Mutating routes should keep using `db.authorize`
 * with the specific permission they need.
 *
 * Usage:
 *   const denied = await requireWorkspaceMember(workspaceId, userId);
 *   if (denied) return denied;
 */
export async function requireWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<NextResponse | null> {
  const member = await db.getWorkspaceUser(workspaceId, userId);
  if (!member) {
    return NextResponse.json(
      { error: 'Tenant boundary violation: User is not authorized in this workspace.' },
      { status: 403 }
    );
  }
  return null;
}
