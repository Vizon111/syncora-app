import { db } from '@/lib/db/storage';

// Rate limiter for AI endpoints, keyed by user id (falling back to a shared
// bucket for anonymous/demo users). This protects the Gemini API quota from
// being exhausted by a script hammering these routes.
//
// Originally an in-memory Map (per-server-instance state, reset on redeploy,
// not shared across instances). Now backed by the `check_ai_rate_limit`
// Postgres RPC defined in supabase/migrations/0004_activity_ai_notifications.sql,
// which performs an atomic check-and-increment guarded by `for update` row
// locking — so concurrent requests from the same user across multiple
// server instances can't race past the limit, unlike the old Map.

/**
 * Checks whether `key` (typically a user id) is within its rate limit for
 * the current 1-minute window, incrementing its request count as a side
 * effect. Returns whether the request is allowed and, if not, how many
 * seconds until the window resets.
 */
export async function checkAiRateLimit(
  key: string,
  maxRequestsPerMinute: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  return db.checkAiRateLimit(key, maxRequestsPerMinute);
}
