import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function TopNav() {
  const { user, me, premium, signOut } = useAuth();
  const nav = useNavigate();

  const chip = me?.profile?.role === 'admin'
    ? <span className="chip admin">Admin</span>
    : premium ? <span className="chip premium">Premium</span>
              : <span className="chip free">Free</span>;

  return (
    <header className="topnav">
      <Link to="/" className="brand">☕ Java <i>LIBRARY</i></Link>
      <nav>
        <Link to="/library" end>Library</Link>
        <Link to="/pricing" >Pricing</Link>
        {user && <>
          {chip}
          <Link to="/account">{me?.profile?.display_name || user.email}</Link>
          <button className="btn ghost"
                  onClick={async () => { await signOut(); nav('/login'); }}>
            Sign out
          </button>
        </>}
      </nav>
    </header>
  );
}