import { admin, userClient, bearerToken } from '../lib/supabase.js';

/* tiny TTL cache so hot paths don't ping Supabase auth on every call */
const cache = new Map();                    // token -> {user,profile,exp}
const TTL = 60_000;

async function resolve(token) {
  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) return hit;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw Object.assign(
    new Error('Invalid or expired session'), { status: 401 });
  const { data: profile } = await admin.from('profiles')
    .select('id,email,display_name,role')
    .eq('id', data.user.id).single();
  const rec = {
    user: data.user,
    profile: profile || { id: data.user.id, email: data.user.email,
                          display_name: '', role: 'reader' },
    exp: Date.now() + TTL
  };
  cache.set(token, rec);
  if (cache.size > 500) cache.clear();      // crude pressure valve
  return rec;
}

/** Hard gate: valid Supabase JWT required; attaches req.user / req.profile */
export function requireAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token)
    return res.status(401).json({ error: 'Sign in required' });
  resolve(token)
    .then(r => {
      req.jwt = token; req.user = r.user; req.profile = r.profile;
      req.sb = userClient(token);        /* RLS-bound client for user writes */
      next();
    })
    .catch(e => res.status(e.status || 401).json({ error: e.message }));
}

/** True when this specific request's bearer token was already validated */
export function optionalAuth(req, _res, next) {
  const token = bearerToken(req);
  if (!token) return next();
  resolve(token)
    .then(r => { req.jwt = token; req.user = r.user; req.profile = r.profile; })
    .catch(() => {})
    .finally(next);
}
