import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/storage';
import { getAuthenticatedUser } from '@/lib/supabase/server';

/** Updates the signed-in user's own profile: display name and/or avatar URL.
 *  Email and password changes go through Supabase Auth directly on the
 *  client (supabase.auth.updateUser), not through this route, since those
 *  require Supabase's own verification/re-authentication handling. */
export async function PATCH(req: NextRequest) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, avatarUrl } = body as { name?: string; avatarUrl?: string };

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
  }
  if (name !== undefined && name.trim().length > 80) {
    return NextResponse.json({ error: 'Name is too long (max 80 characters)' }, { status: 400 });
  }
  if (avatarUrl !== undefined && typeof avatarUrl !== 'string') {
    return NextResponse.json({ error: 'avatarUrl must be a string' }, { status: 400 });
  }

  const updates: { name?: string; avatarUrl?: string } = {};
  if (name !== undefined) updates.name = name.trim();
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const user = await db.updateUser(authUser.id, updates);
  return NextResponse.json({ user });
}
