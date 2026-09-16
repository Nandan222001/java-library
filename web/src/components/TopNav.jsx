import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function TopNav() {
  const { user, me, premium, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  const isAdmin = me?.profile?.role === 'admin';
  const chip = isAdmin
    ? <span className="chip admin">Admin</span>
    : premium ? <span className="chip premium">Premium</span>
              : <span className="chip free">Free</span>;

  /* On the public landing page (/), guests get in-page section links instead of
     app routes they can't open yet. Signed-in readers keep a way back in. */
  const onLanding = loc.pathname === '/';
  const anchor = (href, label) => (
    <a href={href} key={href} onClick={() => setOpen(false)}>{label}</a>
  );

  return (
    <>
    <header className="topnav">
      <Link to={isAdmin ? '/admin' : user ? '/dashboard' : '/'} className="brand">
        ☕ Java <i>LIBRARY</i>
      </Link>

      <button
        className="nav-toggle"
        aria-label="Toggle navigation"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {open ? '✕' : '☰'}
      </button>

      <nav className={open ? 'open' : ''}>
        {onLanding ? (
          <>
            {anchor('#library', 'Shelf')}
            {anchor('#reader', 'Reader')}
            {anchor('#features', 'Features')}
            {anchor('#pricing', 'Pricing')}
            {anchor('#faq', 'FAQ')}
            {user && <NavLink to={isAdmin ? '/admin' : '/library'}>Library</NavLink>}
          </>
        ) : (
          <>
            <NavLink to="/library" end>Library</NavLink>
            {user && !isAdmin && <NavLink to="/dashboard">Dashboard</NavLink>}
            <NavLink to="/pricing">Pricing</NavLink>
            {user && <NavLink to="/leaderboard">Leaderboard</NavLink>}
            {isAdmin && <NavLink to="/admin">Admin</NavLink>}
          </>
        )}
        
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '12px', borderLeft: '1px solid var(--line)', paddingLeft: '24px' }}>
            {chip}
            <NavLink to="/account" style={{ color: 'var(--ink)' }}>
              {me?.profile?.display_name || user.email.split('@')[0]}
            </NavLink>
            <button 
              className="btn ghost" 
              style={{ padding: '6px 12px', fontSize: '14px' }}
              onClick={async () => { await signOut(); nav('/login'); }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', marginLeft: '12px' }}>
            <Link to="/login" className="btn ghost" style={{ padding: '8px 16px', fontSize: '14px' }}>Login</Link>
            <Link to="/signup" className="btn primary" style={{ padding: '8px 16px', fontSize: '14px' }}>Sign Up</Link>
          </div>
        )}
      </nav>
    </header>

    {/* Click-outside-to-close backdrop. Rendered as a SIBLING of <header>, not
        a child — <header> has backdrop-filter, which makes it the containing
        block for any position:fixed descendant, so an overlay nested inside
        it with bottom:0 silently resolves to zero height (it collapses
        against the 72px header box, not the viewport). Kept outside for the
        same reason .admin-overlay lives outside its own filtered ancestor.
        Always mounted (visibility toggled via .open) so it fades in AND out
        instead of popping to full opacity and vanishing instantly. */}
    <div className={'nav-overlay' + (open ? ' open' : '')} onClick={() => setOpen(false)}/>

    </>
  );
}
