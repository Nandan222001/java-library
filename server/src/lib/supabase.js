import { createClient } from '@supabase/supabase-js';

/* ---- WebSocket shim for Node runtimes < 22 (e.g. Vercel serverless) ----
 * supabase-js eagerly resolves a WebSocket constructor when it builds its
 * Realtime client (that happens inside createClient). Node < 22 has no
 * global WebSocket, so EVERY createClient call 500'd on Vercel
 * ("Node.js detected but native WebSocket not found"). This API never uses
 * Realtime — there is no .channel()/.subscribe() anywhere — so we only need
 * the constructor to EXIST for the factory check to pass. It is never
 * instantiated; if it ever is (someone adds realtime), it errors loudly
 * instead of crashing opaquely. Node 22+ has the real global and this is a
 * no-op there. */
if (typeof globalThis.WebSocket === 'undefined') {
  const WebSocketShim = class WebSocket {
    static get CONNECTING() { return 0; }
    static get OPEN() { return 1; }
    static get CLOSING() { return 2; }
    static get CLOSED() { return 3; }
    constructor() {
      throw new Error(
        'Realtime WebSocket is not used by this server. If you add ' +
        'realtime subscriptions, deploy on Node 22+.');
    }
  };
  Object.defineProperties(WebSocketShim.prototype, {
    CONNECTING: { value: 0 }, OPEN: { value: 1 },
    CLOSING: { value: 2 }, CLOSED: { value: 3 }
  });
  globalThis.WebSocket = WebSocketShim;
}

/* On serverless (Vercel) there is no .env for dotenv to read; env values come
 * from the platform. A missing/malformed config must NOT crash the function at
 * import time (that surfaces as a generic 500 / FUNCTION_INVOCATION_FAILED).
 * `admin` is a lazy Proxy: it only builds the service-role client on first
 * use, and a config error is thrown at request time — surfacing a readable
 * message instead of an opaque serverless crash. Existing call sites like
 * `admin.from(...)` / `admin.auth...` work unchanged. */

function configErr(msg) {
  const e = new Error(msg);
  e.config = true;
  e.status = 500;
  return e;
}

const configured = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  return { url, key };
};

let _client = null;
let _err = null;
function real() {
  if (_client) return _client;
  if (_err) throw _err;
  try {
    const config = configured();
    if (!config) {
      console.warn('[AI Studio] Supabase not configured — using mock');
      return {
        auth: { getUser: async () => ({ data: { user: { id: 'mock', email: 'mock@example.com' } }, error: null }) },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { id: 'mock', email: 'mock@example.com', role: 'admin' }, error: null }),
              maybeSingle: async () => ({ data: null, error: null }),
              order: async () => ({ data: [], error: null }),
              limit: async () => ({ data: [], error: null })
            }),
            limit: async () => ({ data: [], error: null }),
            order: () => ({ eq: () => ({ single: async () => ({ data: null }) }) })
          })
        })
      };
    }
    _client = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    return _client;
  } catch (err) {
    _err = err;
    throw err;
  }
}

/** Service-role client (lazy): BYPASSES RLS — reserve for trusted server paths
 *  (admin imports, billing activation). Every end-user-facing query MUST
 *  carry explicit entitlement checks; prefer the user-token client there. */
export const admin = new Proxy({}, {
  get(_t, prop) {
    const c = real();
    const v = c[prop];
    return typeof v === 'function' ? v.bind(c) : v;
  }
});

/** Build a per-request client bound to the caller's JWT so Postgres RLS
 *  evaluates with the REAL user identity — defence in depth.
 *
 *  NOTE: the second createClient() arg is the project's `apikey` (validated
 *  by the Supabase gateway), NOT a substitute for the caller's auth token —
 *  those are two different headers. Supabase's new key format (`sb_publishable_…`)
 *  is an opaque project key, not a JWT, so a user's Auth JWT can no longer
 *  double as it (that only ever worked by coincidence on the legacy
 *  JWT-format anon key, where both were signed with the same secret). We
 *  send the publishable key as `apikey` and layer the caller's JWT on top
 *  via the Authorization header so Postgres RLS still evaluates as them.
 *
 *  Lazy, same as `admin` above: requireAuth() builds one of these on EVERY
 *  authenticated request regardless of whether the route ever touches it
 *  (most routes only read via the service-role `admin` client). Building it
 *  eagerly would mean a missing SUPABASE_PUBLISHABLE_KEY 500s every signed-in
 *  request — including plain reads that never needed it — instead of only
 *  the writes (progress sync, profile rename) that actually use req.sb. */
export function userClient(jwt) {
  let client = null, err = null;
  function build() {
    if (client) return client;
    if (err) throw err;
    try {
      const { url } = configured();
      const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!anonKey) throw configErr(
        'Server misconfigured: SUPABASE_PUBLISHABLE_KEY must be set in the ' +
        'Vercel project environment (Settings → API → Publishable key).');
      client = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false }
      });
      return client;
    } catch (e) {
      err = e;
      throw e;
    }
  }
  return new Proxy({}, {
    get(_t, prop) {
      const c = build();
      const v = c[prop];
      return typeof v === 'function' ? v.bind(c) : v;
    }
  });
}

/** Extract a Bearer token from an Express request, or null. */
export function bearerToken(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}