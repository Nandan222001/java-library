import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/supabase.js';

export default function Login() {
  const { signIn, session, loading, me } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  /* restore an existing session straight into the right landing page --
   * admins go to their own admin dashboard, never the shared reader one. */
  useEffect(() => {
    if (!loading && session) {
      nav(me?.profile?.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    }
  }, [session, loading, me, nav]);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const { error } = await signIn(email.trim(), pass);
      if (error) throw error;
      /* AuthContext's `me` updates asynchronously off the auth-state-change
       * listener, so it isn't populated yet right here -- fetch role
       * directly so an admin lands on /admin, not the shared /dashboard,
       * on their very first redirect after signing in. */
      let role = 'reader';
      try { role = (await api('/api/me'))?.profile?.role || 'reader'; } catch { /* fall back below */ }
      const dest = role === 'admin' ? '/admin' : (loc.state?.from || '/dashboard');
      nav(dest, { replace: true });
    } catch (ex) {
      setErr(ex.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <form className="card auth-page card" style={{ maxWidth: 420 }} onSubmit={submit}>
        <h2>Welcome back ☕</h2>
        <p className="muted">Pick up exactly where you left off.</p>
        {err && <div className="errbox">{err}</div>}
        <label className="field"><span>Email</span>
          <input type="email" required value={email}
                 onChange={e => setEmail(e.target.value)} autoFocus/>
        </label>
        <label className="field"><span>Password</span>
          <input type="password" required minLength={8} value={pass}
                 onChange={e => setPass(e.target.value)}/>
        </label>
        <button className="btn primary" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted" style={{ marginTop: 16 }}>
          New here? <Link to="/signup" style={{ color: 'var(--accent)' }}>Create an account →</Link>
        </p>
      </form>
    </div>
  );
}