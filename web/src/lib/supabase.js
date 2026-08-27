import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://xddhhybyviuntnnymfbo.supabase.co';
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/* Publishable key is public-safe — all privilege decisions happen in
 * Postgres RLS + our Node API, never in this bundle. */
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function currentJwt() {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token || null;
}

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/** Authenticated JSON fetch against the Node API. */
export async function api(path, opts = {}) {
  const jwt = await currentJwt();
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...(opts.headers || {})
    }
  });
  let body = null;
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(body?.error || `HTTP ${res.status}`);
    err.status = res.status; err.body = body;
    throw err;
  }
  return body;
}