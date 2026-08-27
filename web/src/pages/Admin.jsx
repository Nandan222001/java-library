import { useEffect, useState } from 'react';
import { api } from '../lib/supabase.js';

const TABS = ['Books', 'Plans', 'Users'];

export default function Admin() {
  const [tab, setTab] = useState('Books');
  return (
    <div className="container">
      <h1>Admin ⚙️</h1>
      <div className="admin-tabs">
        {TABS.map(t => (
          <button key={t} className={'admin-tab' + (tab === t ? ' active' : '')}
                  onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'Books' && <BooksPanel/>}
      {tab === 'Plans' && <PlansPanel/>}
      {tab === 'Users' && <UsersPanel/>}
    </div>
  );
}

function BooksPanel() {
  const [books, setBooks] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/api/admin/books').then(setBooks).catch(e => setErr(e.message));
  }, []);

  function updateField(id, field, value) {
    setBooks(bs => bs.map(b => (b.id === id ? { ...b, [field]: value } : b)));
  }

  async function save(b) {
    setSaving(b.id); setMsg('');
    try {
      const saved = await api(`/api/admin/books/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: b.title, subtitle: b.subtitle, author: b.author,
          cover_emoji: b.cover_emoji, tier: b.tier,
          price_paise: Math.max(0, Math.round(Number(b.price_paise) || 0)),
          published: !!b.published
        })
      });
      setMsg(`Saved "${saved.title}" ✓`);
    } catch (e) { setMsg(e.message); }
    finally { setSaving(''); }
  }

  if (err) return <div className="errbox">{err}</div>;
  if (!books) return <div className="loading-block"><div className="spin"/><span>Loading books…</span></div>;

  return (
    <div>
      {msg && <div className="infobox">{msg}</div>}
      <div className="admin-table">
        {books.map(b => (
          <div key={b.id} className="card admin-row">
            <div className="admin-row-grid">
              <label className="field"><span>Title</span>
                <input value={b.title} onChange={e => updateField(b.id, 'title', e.target.value)}/>
              </label>
              <label className="field"><span>Subtitle</span>
                <input value={b.subtitle} onChange={e => updateField(b.id, 'subtitle', e.target.value)}/>
              </label>
              <label className="field"><span>Author</span>
                <input value={b.author} onChange={e => updateField(b.id, 'author', e.target.value)}/>
              </label>
              <label className="field"><span>Cover</span>
                <input value={b.cover_emoji} maxLength={8}
                       onChange={e => updateField(b.id, 'cover_emoji', e.target.value)}/>
              </label>
              <label className="field"><span>Tier</span>
                <select value={b.tier} onChange={e => updateField(b.id, 'tier', e.target.value)}>
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
              <label className="field"><span>Price (₹, 0 = not sold individually)</span>
                <input type="number" min="0" value={b.price_paise / 100}
                       onChange={e => updateField(b.id, 'price_paise', Math.round(Number(e.target.value) * 100))}/>
              </label>
              <label className="field checkbox-field">
                <input type="checkbox" checked={!!b.published}
                       onChange={e => updateField(b.id, 'published', e.target.checked)}/>
                <span>Published</span>
              </label>
            </div>
            <button className="btn primary" disabled={saving === b.id} onClick={() => save(b)}>
              {saving === b.id ? 'Saving…' : 'Save'}
            </button>
          </div>
        ))}
        {books.length === 0 && <div className="infobox">No books yet — import one via the CLI script.</div>}
      </div>
    </div>
  );
}

function PlansPanel() {
  const [plans, setPlans] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/api/billing/plans').then(setPlans).catch(e => setErr(e.message));
  }, []);

  function updateField(id, field, value) {
    setPlans(ps => ps.map(p => (p.plan_id === id ? { ...p, [field]: value } : p)));
  }
  function updateFeature(id, idx, value) {
    setPlans(ps => ps.map(p => (p.plan_id === id
      ? { ...p, features: p.features.map((f, i) => (i === idx ? value : f)) }
      : p)));
  }

  async function save(p) {
    setSaving(p.plan_id); setMsg('');
    try {
      const saved = await api(`/api/admin/plans/${p.plan_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: p.name,
          price_paise: Math.max(0, Math.round(Number(p.price_paise) || 0)),
          interval_days: Math.max(0, Math.round(Number(p.interval_days) || 0)),
          features: p.features
        })
      });
      setMsg(`Saved "${saved.name}" ✓`);
    } catch (e) { setMsg(e.message); }
    finally { setSaving(''); }
  }

  if (err) return <div className="errbox">{err}</div>;
  if (!plans) return <div className="loading-block"><div className="spin"/><span>Loading plans…</span></div>;

  return (
    <div>
      {msg && <div className="infobox">{msg}</div>}
      <div className="admin-table">
        {plans.map(p => (
          <div key={p.plan_id} className="card admin-row">
            <div className="admin-row-grid">
              <label className="field"><span>Name</span>
                <input value={p.name} onChange={e => updateField(p.plan_id, 'name', e.target.value)}/>
              </label>
              <label className="field"><span>Price (₹)</span>
                <input type="number" min="0" value={p.price_paise / 100}
                       onChange={e => updateField(p.plan_id, 'price_paise', Math.round(Number(e.target.value) * 100))}/>
              </label>
              <label className="field"><span>Interval (days)</span>
                <input type="number" min="0" value={p.interval_days}
                       onChange={e => updateField(p.plan_id, 'interval_days', Number(e.target.value))}/>
              </label>
            </div>
            <div className="admin-features">
              <span className="muted fs13">Features</span>
              {p.features.map((f, i) => (
                <input key={i} value={f} onChange={e => updateFeature(p.plan_id, i, e.target.value)}/>
              ))}
            </div>
            <button className="btn primary" disabled={saving === p.plan_id} onClick={() => save(p)}>
              {saving === p.plan_id ? 'Saving…' : 'Save'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  function load() {
    api('/api/admin/users' + (q ? `?q=${encodeURIComponent(q)}` : ''))
      .then(setUsers).catch(e => setErr(e.message));
  }
  useEffect(load, []);   // eslint-disable-line react-hooks/exhaustive-deps

  async function changeRole(u, role) {
    setBusy(u.id); setMsg('');
    try {
      await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ role }) });
      setMsg(`${u.display_name || u.email} is now ${role}`);
      load();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(''); }
  }

  async function grantPremium(u) {
    setBusy(u.id); setMsg('');
    try {
      await api(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ grant_premium: { plan_id: 'premium_monthly' } })
      });
      setMsg(`Granted premium to ${u.display_name || u.email}`);
      load();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(''); }
  }

  async function revokePremium(u) {
    setBusy(u.id); setMsg('');
    try {
      await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ revoke_premium: true }) });
      setMsg(`Revoked premium from ${u.display_name || u.email}`);
      load();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(''); }
  }

  if (err) return <div className="errbox">{err}</div>;

  return (
    <div>
      <div className="admin-search">
        <input placeholder="Search by name or email…" value={q}
               onChange={e => setQ(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && load()}/>
        <button className="btn" onClick={load}>Search</button>
      </div>
      {msg && <div className="infobox">{msg}</div>}
      {!users
        ? <div className="loading-block"><div className="spin"/><span>Loading users…</span></div>
        : <div className="admin-table">
            {users.map(u => (
              <div key={u.id} className="card admin-row admin-user-row">
                <div>
                  <b>{u.display_name || '—'}</b>
                  <div className="muted fs13">{u.email}</div>
                  {u.subscription
                    ? <span className="chip premium">premium · until {new Date(u.subscription.current_end).toLocaleDateString()}</span>
                    : <span className="chip free">free</span>}
                </div>
                <select value={u.role} disabled={busy === u.id}
                        onChange={e => changeRole(u, e.target.value)}>
                  <option value="reader">reader</option>
                  <option value="publisher">publisher</option>
                  <option value="admin">admin</option>
                </select>
                {u.subscription
                  ? <button className="btn danger" disabled={busy === u.id} onClick={() => revokePremium(u)}>Revoke premium</button>
                  : <button className="btn" disabled={busy === u.id} onClick={() => grantPremium(u)}>Grant premium</button>}
              </div>
            ))}
            {users.length === 0 && <div className="infobox">No users match.</div>}
          </div>}
    </div>
  );
}
