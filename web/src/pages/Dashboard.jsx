import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/supabase.js';

/* User dashboard — role-aware. Shows the reader's own stats, current books,
 * gamification progress, and the features their role unlocks.
 *
 * Admins never see this page: it redirects straight to /admin. This is
 * deliberately a component-level guard (not just a one-time redirect at
 * login) so it also catches every OTHER way an admin can land here —
 * clicking the brand logo, a stale bookmark, browser back/forward. */
export default function Dashboard() {
  const { me, role } = useAuth();
  const [books, setBooks] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/books').then(setBooks).catch(e => setErr(e.message));
  }, []);

  /* `role` defaults to 'reader' until `me` loads, so gate on `me` itself —
   * otherwise every admin flashes the reader dashboard for a moment first. */
  if (!me) return <div className="container loading-block"><div className="spin"/><span>Loading…</span></div>;
  if (role === 'admin') return <Navigate to="/admin" replace />;

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
      <header className="dash-hello">
        <div>
          <h1>
            {firstName
              ? `Welcome back, ${firstName} ☕`
              : 'Welcome back ☕'}
          </h1>
          <p className="muted">
            Your library at a glance —
            {isStaff
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
      </header>

      <div className="dash-stats">
        <div className="stat-card card">
          <div className="stat-label">Books unlocked</div>
          <div className="stat-num">{unlocked.length}<span className="stat-sub" style={{ fontSize: '18px', color: 'var(--ink-muted)' }}>/{list.length}</span></div>
        </div>
        <div className="stat-card card">
          <div className="stat-label">Practice points</div>
          <div className="stat-num">{me?.points ?? 0}</div>
        </div>
        <div className="stat-card card">
          <div className="stat-label">Current streak</div>
          <div className="stat-num">{me?.current_streak ?? 0} 🔥</div>
        </div>
        <div className="stat-card card">
          <div className="stat-label">Badges earned</div>
          <div className="stat-num">{me?.badges?.length ?? 0}</div>
        </div>
        <Link to="/leaderboard" className="stat-card card stat-link">
          <div className="stat-label">Leaderboard</div>
          <div className="stat-num">🏆</div>
        </Link>
      </div>

      {books && continuing.length > 0 && (
        <section className="dash-section" style={{ marginTop: 'var(--space-3xl)' }}>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>↪ Continue reading</h2>
          <div className="grid-books">
            {continuing.map(b => (
              <Link key={b.id} to={`/read/${b.slug}?p=${b.continue_flips}`} className="card book-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="emoji" style={{ fontSize: '32px' }}>{b.cover_emoji}</span>
                  <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    Resume p.{b.continue_flips * 2}
                  </span>
                </div>
                <h3>{b.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="dash-cols" style={{ marginTop: 'var(--space-3xl)' }}>
        <section className="card dash-panel">
          <h3>🎯 Role &amp; permissions</h3>
          <ul className="dash-perms" style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}><b style={{ color: '#fff' }}>reader</b> — all free books + owned content.</li>
            <li style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}><b style={{ color: 'var(--gold)' }}>premium</b> — all premium content + new releases first.</li>
            <li style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}><b style={{ color: 'var(--accent)' }}>publisher</b> — staff access: preview unpublished content.</li>
            <li style={{ padding: '8px 0' }}><b style={{ color: '#769eff' }}>admin</b> — full platform control & analytics.</li>
          </ul>
          <div className="dash-actions" style={{ marginTop: 'auto', paddingTop: '20px' }}>
            <Link className="btn primary" to={locked.length ? '/pricing' : '/library'}>
              {locked.length ? `Unlock ${locked.length} more book${locked.length === 1 ? '' : 's'} →` : 'Browse library →'}
            </Link>
            {unlocked[0] && (
              <Link className="btn ghost" to={`/books/${unlocked[0].slug}/practice`}>🎯 Practice</Link>
            )}
          </div>
        </section>

        <section className="card dash-panel">
          <h3>
            {role === 'admin' ? '🛠️ Admin workspace'
             : role === 'publisher' ? '🖋️ Publisher workspace'
             : '✨ Your progress'}
          </h3>
          <div style={{ flex: 1 }}>
            {role === 'admin' && (
              <p className="muted">
                You run the platform — manage books, plans, users, read-permission
                grants, and monitor live sales on the admin dashboard.
              </p>
            )}
            {role === 'publisher' && (
              <p className="muted">
                As a publisher every book is unlocked for you, including unpublished
                previews. Manage content via the import CLI or coordinated panel.
              </p>
            )}
            {role === 'reader' && (
              <p className="muted">
                Answer <strong>practice quizzes</strong> under any book to earn points, keep
                weekly streaks and collect badges — then climb the leaderboard.
              </p>
            )}
            {me?.badges?.length > 0 && (
              <div className="pillrow" style={{ marginTop: '16px' }}>
                {me.badges.slice(0, 6).map(b => (
                  <span key={b.id} className="chip premium" title={b.description}>
                    {b.icon} {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="dash-actions" style={{ marginTop: 'auto', paddingTop: '20px' }}>
            {role === 'admin' && <Link className="btn primary" to="/admin">Open admin dashboard →</Link>}
            <Link className="btn ghost" to="/library">Library</Link>
            <Link className="btn ghost" to="/pricing">Plans</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
