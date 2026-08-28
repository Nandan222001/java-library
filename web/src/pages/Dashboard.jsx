import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/supabase.js';

/* User dashboard — role-aware. Shows the reader's own stats, current books,
 * gamification progress, and the features their role unlocks. */
export default function Dashboard() {
  const { me, role } = useAuth();
  const [books, setBooks] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/books').then(setBooks).catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="container"><div className="errbox">{err}</div></div>;

  const list = books || [];
  const unlocked = list.filter(b => !b.locked);
  const locked = list.filter(b => b.locked);
  const continuing = [...list]
    .filter(b => (b.continue_flips || 0) > 0)
    .sort((a, b) => b.continue_flips - a.continue_flips).slice(0, 4);

  const isStaff = role === 'admin' || role === 'publisher';
  const firstName = (me?.profile?.display_name || '').split(' ')[0];

  return (
    <div className="container">
      <div className="dash-hello">
        <div>
          <h1 style={{ margin: 0 }}>
            {firstName
              ? `Welcome back, ${firstName} ☕`
              : 'Welcome back ☕'}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Your library at a glance —{isStaff
              ? ' staff account, every book unlocked.'
              : me?.entitlements?.premium
                ? ' premium reader.'
                : ' pick up where you left off.'}
          </p>
        </div>
        <span className={'chip ' + (role === 'admin' ? 'admin'
          : role === 'publisher' ? 'premium'
          : me?.entitlements?.premium ? 'premium' : 'free')}>
          {role}{me?.entitlements?.premium ? ' · premium' : ''}
        </span>
      </div>

      <div className="dash-stats">
        <div className="stat-card">
          <div className="stat-label">Books unlocked</div>
          <div className="stat-num">{unlocked.length}<span className="stat-sub">/{list.length}</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Practice points</div>
          <div className="stat-num">{me?.points ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current streak</div>
          <div className="stat-num">{me?.current_streak ?? 0} 🔥</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Badges earned</div>
          <div className="stat-num">{me?.badges?.length ?? 0}</div>
        </div>
        <Link to="/leaderboard" className="stat-card stat-link">
          <div className="stat-label">Leaderboard</div>
          <div className="stat-num">🏆</div>
        </Link>
      </div>
      {books && continuing.length > 0 && (
        <section className="dash-section">
          <h2>↪ Continue reading</h2>
          <div className="grid-books">
            {continuing.map(b => (
              <Link key={b.id} to={`/read/${b.slug}?p=${b.continue_flips}`} className="card book-card">
                <span style={{ fontSize: 38 }}>{b.cover_emoji}</span>
                <h3 style={{ margin: 0 }}>{b.title}</h3>
                <span className="chip" style={{ background: '#82aaff1f', color: '#b9cfff', marginTop: 'auto' }}>
                  ↩ resume p.{b.continue_flips * 2}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="dash-cols">
        <section className="card dash-panel">
          <h3 style={{ marginTop: 0 }}>🎯 Role &amp; permissions</h3>
          <ul className="dash-perms">
            <li><b>reader</b> — read every <b>free</b> book + books you bought or were granted.</li>
            <li><b>premium</b> — all premium books, full-text search, new releases first.</li>
            <li><b>publisher</b> — staff access: every book incl. unpublished previews; manage content.</li>
            <li><b>admin</b> — everything + the full admin dashboard, users, billing and read grants.</li>
          </ul>
          <div className="dash-actions">
            <Link className="btn primary" to={locked.length ? '/pricing' : '/library'}>
              {locked.length ? `Unlock ${locked.length} more book${locked.length === 1 ? '' : 's'} →` : 'Browse library →'}
            </Link>
            {unlocked[0] && (
              <Link className="btn ghost" to={`/books/${unlocked[0].slug}/practice`}>🎯 Practice</Link>
            )}
            <Link className="btn ghost" to="/account">Account</Link>
          </div>
        </section>

        <section className="card dash-panel">
          <h3 style={{ marginTop: 0 }}>
            {role === 'admin' ? '🛠️ Admin workspace'
             : role === 'publisher' ? '🖋️ Publisher workspace'
             : '✨ Your progress'}
          </h3>
          {role === 'admin' && (
            <p className="muted">
              You run the platform — manage books, plans, users, read-permission
              grants, email and watch live sales on the admin dashboard.
            </p>
          )}
          {role === 'publisher' && (
            <p className="muted">
              As a publisher every book is unlocked for you, including unpublished
              previews. Use the import CLI or coordinate with an admin for the
              content management panel.
            </p>
          )}
          {role === 'reader' && (
            <p className="muted">
              Answer <b>practice quizzes</b> under any book to earn points, keep
              weekly streaks and collect badges — then climb the leaderboard.
            </p>
          )}
          {me?.badges?.length > 0 && (
            <div className="pillrow" style={{ margin: '10px 0 0' }}>
              {me.badges.slice(0, 6).map(b => (
                <span key={b.id} className="chip premium" title={b.description}>
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          )}
          <div className="dash-actions">
            {role === 'admin' && <Link className="btn primary" to="/admin">Open admin dashboard →</Link>}
            <Link className="btn ghost" to="/library">Library</Link>
            <Link className="btn ghost" to="/pricing">Plans</Link>
          </div>
        </section>
      </div>
    </div>
  );
}