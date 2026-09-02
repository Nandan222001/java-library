import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/supabase.js';

export default function Account() {
  const { user, me, signOut } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState(me?.profile?.display_name || '');
  const [msg, setMsg] = useState(null);
  const sub = me?.subscription;

  async function save() {
    setMsg(null);
    try {
      await api('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ display_name: name })
      });
      setMsg({ t: 'ok', m: 'Profile saved ✓' });
    } catch (e) { setMsg({ t: 'err', m: e.message }); }
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <header style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1>Account Settings</h1>
        <p className="muted">Manage your profile, subscription, and achievements.</p>
      </header>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ marginBottom: 'var(--space-md)' }}>👤 Profile</h3>
        <label className="field">
          <span>Email Address</span>
          <input value={user?.email || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
        </label>
        <label className="field">
          <span>Display Name</span>
          <input value={name} maxLength={60}
                 onChange={e => setName(e.target.value)} 
                 placeholder="How should we call you?" />
        </label>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 'var(--space-md)' }}>
          <button className="btn primary" onClick={save}>Save Changes</button>
          {me && (
            <span className={'chip ' + (me.profile.role === 'admin' ? 'admin' : me.entitlements.premium ? 'premium' : 'free')}>
              {me.profile.role}{me.entitlements.premium ? ' · premium' : ''}
            </span>
          )}
        </div>
        {msg && <div className={msg.t === 'ok' ? 'infobox' : 'errbox'} style={{ marginTop: '16px' }}>{msg.m}</div>}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ marginBottom: 'var(--space-md)' }}>💳 Subscription</h3>
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          {!me || me.entitlements.staff
            ? <p className="muted">You are using a <strong>Staff Account</strong>. Every book and feature is unlocked automatically.</p>
            : !sub
              ? <p className="muted">You're currently on the <strong>Free</strong> plan. Upgrade to Premium for full access.</p>
              : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', textTransform: 'capitalize' }}>
                      {sub.plan_id.replace('_', ' ')} Plan
                    </p>
                    <p className="muted" style={{ margin: 0, fontSize: '14px' }}>
                      Active until {new Date(sub.current_end).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="chip premium">{sub.provider}</span>
                </div>
              )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, borderTop: '1px solid var(--line)', paddingTop: '20px' }}>
          <Link className="btn primary" to="/pricing">Manage Plan</Link>
          <Link className="btn ghost" to="/library">Browse Library</Link>
          <button 
            className="btn danger ghost" 
            style={{ marginLeft: 'auto' }}
            onClick={async () => { await signOut(); nav('/login'); }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-md)' }}>🎮 Mastery Progress</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px', textAlign: 'center' }}>
          <div>
            <div className="stat-label">Points</div>
            <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'Playfair Display' }}>{me?.points ?? 0}</div>
          </div>
          <div>
            <div className="stat-label">Streak</div>
            <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'Playfair Display' }}>{me?.current_streak ?? 0} 🔥</div>
          </div>
          <div>
            <div className="stat-label">Max Streak</div>
            <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'Playfair Display' }}>{me?.longest_streak ?? 0}</div>
          </div>
        </div>
        
        {me?.badges?.length ? (
          <div className="pillrow" style={{ gap: '8px' }}>
            {me.badges.map(b => (
              <span key={b.id} className="chip premium" title={b.description} style={{ padding: '6px 12px' }}>
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ textAlign: 'center' }}>No badges earned yet. Complete quizzes to earn your first one!</p>
        )}
        
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/leaderboard" className="btn ghost" style={{ width: '100%' }}>View Global Leaderboard →</Link>
        </div>
      </div>
    </div>
  );
}
