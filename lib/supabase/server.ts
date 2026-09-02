import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Reads/writes the user's session from cookies, so
 * requests are authenticated as the actual signed-in user — this is what
 * replaces the `x-user-id` header trust model from the prototype.
 *
 * Uses the anon key (not the service role key): RLS policies from
 * supabase/migrations/ apply to queries made with this client. Application
 * code (lib/db/storage.ts) continues to use the service-role client for its
 * own authorization logic (see lib/db/supabase-client.ts) — this client is
 * for session/identity resolution in API routes, i.e. "who is making this
 * request", not for querying app data.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).'
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't set cookies (no response to attach them
          // to) — safe to ignore here since middleware.ts refreshes the
          // session on every request and IS able to set cookies.
        }
      },
    },
  });
}

/**
 * Resolves the authenticated user for the current request, or null if not
 * signed in. This is the direct replacement for:
 *
 *   const userId = req.headers.get('x-user-id') || 'usr_demo';
 *
 * The critical difference: `req.headers.get('x-user-id')` was a value the
 * client could set to anything. `getAuthenticatedUser()` returns an id that
 * Supabase Auth has cryptographically verified from the session cookie —
 * callers no longer need to trust the client's word for who they are.
 */
export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}
