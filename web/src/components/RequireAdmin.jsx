import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/* Client-side UX gate only — redirects a non-admin away from /admin so
 * they don't see a page full of 403s. The REAL enforcement is server-side
 * (adminGate in server/src/routes/admin.js); this never substitutes for it. */
export default function RequireAdmin({ children }) {
  const { session, me, loading } = useAuth();
  /* `me` (the /api/me profile fetch) resolves asynchronously AFTER the
   * session itself does -- without this, an admin gets bounced to
   * /library for the one render where session is set but me isn't yet. */
  if (loading || (session && !me))
    return <div className="loading-block"><div className="spin"/><span>Checking your session…</span></div>;
  if (me?.profile?.role !== 'admin')
    return <Navigate to="/library" replace />;
  return children;
}
