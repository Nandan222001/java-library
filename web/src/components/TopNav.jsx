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

  return (
    <header className="topnav">
      <Link to={isAdmin ? '/admin' : user ? '/dashboard' : '/'} className="brand">
        ☕ Java <i>LIBRARY</i>
      </Link>
      
      <button 
        className="nav-toggle" 
        aria-label="Toggle navigation" 
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{ marginLeft: 'auto', display: 'none', background: 'transparent', border: 'none', color: 'inherit', fontSize: '24px', cursor: 'pointer' }}
      >
        {open ? '✕' : '☰'}
      </button>

      <nav className={open ? 'open' : ''}>
        <NavLink to="/library" end>Library</NavLink>
        {user && !isAdmin && <NavLink to="/dashboard">Dashboard</NavLink>}
        <NavLink to="/pricing">Pricing</NavLink>
        {user && <NavLink to="/leaderboard">Leaderboard</NavLink>}
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        
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

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 900px) {
          .nav-toggle { display: block !important; }
          .topnav nav { 
            position: fixed; top: 72px; left: 0; right: 0; 
            flex-direction: column; background: var(--bg); 
            padding: var(--space-lg); border-bottom: 1px solid var(--line);
            max-height: 0; overflow: hidden; transition: max-height 0.3s ease;
            align-items: flex-start; gap: 4px;
          }
          .topnav nav.open { max-height: 100vh; }
          .topnav nav div { 
            margin-left: 0 !important; border-left: none !important; 
            padding-left: 0 !important; padding-top: 12px; 
            margin-top: 12px; border-top: 1px solid var(--line); 
            width: 100%; flex-wrap: wrap;
          }
        }
      `}} />
    </header>
  );
}
