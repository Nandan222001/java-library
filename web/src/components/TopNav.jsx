import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function TopNav() {
  const { user, me, premium, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  /* narrow screens have no room for brand + Library + Pricing + role chip +
   * account link + sign out in one row (they were clipping off-screen,
   * making sign-out unreachable on mobile) -- collapse into a dropdown */
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  const chip = me?.profile?.role === 'admin'
    ? <span className="chip admin">Admin</span>
    : premium ? <span className="chip premium">Premium</span>
              : <span className="chip free">Free</span>;

  return (
    <header className="topnav">
      <Link to="/" className="brand">☕ Java <i>LIBRARY</i></Link>
      <button className="nav-toggle" aria-label="Menu" aria-expanded={open}
              onClick={() => setOpen(o => !o)}>
        {open ? '✕' : '☰'}
      </button>
      <nav className={open ? 'open' : ''}>
        {/* NavLink (not Link) so `end` and the .active CSS highlight
            actually work -- both were previously no-ops on a plain Link */}
        <NavLink to="/library" end>Library</NavLink>
        <NavLink to="/pricing">Pricing</NavLink>
        {user && <NavLink to="/leaderboard">Leaderboard</NavLink>}
        {me?.profile?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        {user && <>
          {chip}
          <NavLink to="/account">{me?.profile?.display_name || user.email}</NavLink>
          <button className="btn ghost"
                  onClick={async () => { await signOut(); nav('/login'); }}>
            Sign out
          </button>
        </>}
      </nav>
    </header>
  );
}
