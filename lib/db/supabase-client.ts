import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the service role key.
 *
 * This intentionally bypasses Row Level Security. It's safe to do so *only*
 * because this client is never imported into client-side code (there is no
 * 'use client' file that touches lib/db/storage.ts) and every mutating route
 * still runs its own authorization check via db.authorize() / rbac.ts before
 * touching data — see lib/db/rbac.ts and lib/auth/require-workspace-member.ts.
 *
 * Why not rely on RLS + auth.uid() instead, now that Этап 2 (Supabase Auth,
 * lib/supabase/server.ts) is in place and a real verified session exists?
 * Two reasons this client still uses the service role rather than switching
 * every route to a per-request RLS-scoped client:
 *   1. It keeps a single, already-tested authorization path (db.authorize())
 *      instead of running two enforcement mechanisms (RLS and application
 *      code) that could drift out of sync with each other over time.
 *   2. Several read paths (e.g. RAG indexing, activity logging, retro
 *      summaries) are legitimately cross-cutting and don't map cleanly onto
 *      "the current user's own rows" the way RLS is best suited for.
 * The RLS policies in supabase/migrations/ remain in place as defense in
 * depth — if a bug ever caused a route to skip db.authorize(), RLS is the
 * backstop. Individual read-only routes can still be migrated to a
 * session-scoped client on a case-by-case basis where it clearly simplifies
 * things; this file doesn't need to change for that.
 */

const globalForSupabase = global as unknown as { supabaseAdmin?: SupabaseClient };

function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        '(see .env.example).'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const supabaseAdmin = globalForSupabase.supabaseAdmin || createServiceRoleClient();
if (process.env.NODE_ENV !== 'production') globalForSupabase.supabaseAdmin = supabaseAdmin;

/**
 * Throws with the underlying Postgres/PostgREST error message attached,
 * instead of silently returning undefined — a bug in a raw Map.get() call
 * fails loudly at the call site (undefined property access); a swallowed
 * Supabase error would fail silently and be much harder to debug.
 */
export function assertNoError<T>(result: { data: T; error: { message: string } | null }, context: string): T {
  if (result.error) {
    throw new Error(`[db] ${context}: ${result.error.message}`);
  }
  return result.data;
}
