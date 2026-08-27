import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

/** Service-role client: BYPASSES RLS — reserve for trusted server paths
 *  (admin imports, billing activation). Every end-user-facing query MUST
 *  carry explicit entitlement checks; prefer the user-token client there. */
export const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/** Build a per-request client bound to the caller's JWT so Postgres RLS
 *  evaluates with the REAL user identity — defence in depth. */
export function userClient(jwt) {
  return createClient(process.env.SUPABASE_URL, jwt, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

/** Extract a Bearer token from an Express request, or null. */
export function bearerToken(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}