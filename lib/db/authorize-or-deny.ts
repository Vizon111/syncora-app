import { NextResponse } from 'next/server';
import { db } from './storage';
import { Permission } from './rbac';
import { WorkspaceMember } from '@/lib/types';

/**
 * Result of a successful authorization check — the caller's confirmed
 * membership record, most commonly used for its `.role` when logging
 * activity (e.g. `userRole: auth.member.role`).
 */
export type AuthorizedContext = { member: WorkspaceMember };

/**
 * Single authorization checkpoint for mutating (POST/PUT/PATCH/DELETE)
 * routes, replacing the repeated three-line pattern that used to appear at
 * the top of every action branch:
 *
 *   const auth = await db.authorize(workspaceId, userId, 'task:create');
 *   if (!auth.authorized) {
 *     return NextResponse.json({ error: auth.error }, { status: 403 });
 *   }
 *   // ...use auth.member...
 *
 * becomes:
 *
 *   const auth = await authorizeOrDeny(workspaceId, userId, 'task:create');
 *   if (auth instanceof NextResponse) return auth;
 *   // ...use auth.member...
 *
 * This doesn't change *what* gets enforced (still lib/db/rbac.ts's
 * role -> permission table via db.authorize, still per-workspace, still one
 * explicit call per mutation) — Этап 3 asked for the duplication to be
 * removed, not for the check itself to move. A full route-level HOF wasn't
 * used here because these routes dispatch on a runtime `action` field in the
 * request body (see app/api/tasks/route.ts, app/api/sprints/route.ts, etc),
 * so the required Permission often isn't knowable until the handler is
 * already running — a wrapper around the whole handler couldn't select the
 * right permission without reimplementing that dispatch itself.
 *
 * Returns either the authorized context, or a ready-to-return 403
 * NextResponse — callers check `instanceof NextResponse` and return it
 * directly, so the calling code stays a two-line guard clause instead of
 * duplicating the error-shaping logic at every call site.
 */
export async function authorizeOrDeny(
  workspaceId: string,
  userId: string,
  permission: Permission
): Promise<AuthorizedContext | NextResponse> {
  const auth = await db.authorize(workspaceId, userId, permission);
  if (!auth.authorized || !auth.member) {
    return NextResponse.json({ error: auth.error || 'Forbidden' }, { status: 403 });
  }
  return { member: auth.member };
}
