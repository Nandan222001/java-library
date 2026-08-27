import { createContext, useContext, useEffect, useState } from 'react';
import { sb, currentJwt, api } from '../lib/supabase.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);          // /api/me payload
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    if (!(await currentJwt())) { setMe(null); return; }
    try { setMe(await api('/api/me')); }
    catch { setMe(null); }
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange(async (ev, s) => {
      setSession(s);
      if (ev === 'SIGNED_OUT') setMe(null);
      else if (s) await refreshMe();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  /* keep engine bridge in sync for RLS-scoped Postgres reads */
  useEffect(() => {
    currentJwt().then(t => { window.__SB_AUTH_JWT = t || null; });
  }, [session]);

  const value = {
    session, user: session?.user || null, me, loading,
    role: me?.profile?.role || 'reader',
    premium: !!me?.entitlements?.premium,
    async signUp(email, password, displayName) {
      return sb.auth.signUp({
        email, password,
        options: { data: { display_name: displayName } }
      });
    },
    signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
    signOut: async () => { await sb.auth.signOut(); setMe(null); setSession(null); },
    refreshMe
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}