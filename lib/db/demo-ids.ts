/**
 * Stable demo/seed identifiers.
 *
 * The original in-memory prototype used human-readable string ids
 * (`usr_demo`, `ws_acme`, `prj_flowspace_core`, ...) as fallback defaults
 * throughout the API routes, e.g.:
 *
 *   const userId = req.headers.get('x-user-id') || 'usr_demo';
 *
 * Postgres primary/foreign keys in supabase/migrations/ are typed `uuid`
 * (chosen for compatibility with Supabase Auth's auth.users.id, which is
 * always a real UUID — see Этап 2). Since every id in the app must now be a
 * valid UUID, these fallback string constants have been replaced with fixed
 * UUIDs. Run `supabase/seed.sql` (or equivalent) to insert rows using these
 * exact ids so the demo defaults keep working end-to-end.
 */
export const DEMO_USER_ID = 'd71c563f-8e8d-4645-9071-c29a4c1d45ec';
export const DEMO_WORKSPACE_ID = '8a4f77ad-2000-42e0-a0c9-4f4d904c5aff';
export const DEMO_WORKSPACE_ALPHA_ID = 'e1a71b6e-0e89-499a-a460-547c9f3ed8cc';
export const DEMO_PROJECT_ID = 'f15826ae-80da-4958-8495-d42f88dfe997';
