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
      <h1>Account</h1>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>👤 Profile</h3>
        <label className="field"><span>Email</span>
          <input value={user?.email || ''} disabled/>
        </label>
        <label className="field"><span>Display name</span>
          <input value={name} maxLength={60}
                 onChange={e => setName(e.target.value)}/>
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={save}>Save profile</button>
          {me && <span className={'chip ' +
              (me.profile.role === 'reader'
                ? me.entitlements.premium ? 'premium' : 'free'
                : 'admin')}>
            role · {me.profile.role}{me.entitlements.premium ? ' · premium' : ''}
          </span>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>💳 Subscription</h3>
        {!me || me.entitlements.staff
          ? <p className="muted">Staff account — everything unlocked.</p>
          : !sub
            ? <p className="muted">You're on the Free plan.</p>
            : <>
                <p>
                  <b>{sub.plan_id.replace('_', ' ')}</b> · active until{' '}
                  <b>{new Date(sub.current_end).toLocaleDateString()}</b>
                  {' '}<span className="chip premium">{sub.provider}</span>
                </p>
                {sub.status !== 'active' &&
                  <p className="muted">Renewal canceled — access continues until expiry.</p>}
              </>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link2Pricing/>
          <Link className="btn ghost" to="/library">Library</Link>
          <button className="btn danger" style={{ marginLeft: 'auto' }}
                  onClick={async () => { await signOut(); nav('/login'); }}>
            Sign out
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>🎮 Progress</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 14 }}>
          <div><div className="muted fs13">Points</div><b style={{ fontSize: 22 }}>{me?.points ?? 0}</b></div>
          <div><div className="muted fs13">Current streak</div><b style={{ fontSize: 22 }}>{me?.current_streak ?? 0} 🔥</b></div>
          <div><div className="muted fs13">Longest streak</div><b style={{ fontSize: 22 }}>{me?.longest_streak ?? 0}</b></div>
        </div>
        {me?.badges?.length
          ? <div className="pillrow" style={{ margin: 0 }}>
              {me.badges.map(b => (
                <span key={b.id} className="chip premium" title={b.description}>
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          : <p className="muted">No badges yet — take a practice quiz to start earning points.</p>}
        <Link to="/leaderboard" className="btn ghost" style={{ marginTop: 14 }}>See leaderboard →</Link>
      </div>
    </div>
  );
}

function Link2Pricing() {
  return <Link className="btn primary" to="/pricing">Manage plan</Link>;
}