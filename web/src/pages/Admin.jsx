import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', desc: 'Revenue, signups & activity', group: 'Overview' },
  { id: 'books', label: 'Books', icon: '📚', desc: 'Catalog, pricing & publishing', group: 'Content' },
  { id: 'plans', label: 'Plans', icon: '💳', desc: 'Subscription plans & billing', group: 'Monetisation' },
  { id: 'users', label: 'Users', icon: '👥', desc: 'Members, roles & premium access', group: 'People' },
  { id: 'grants', label: 'Read grants', icon: '🔓', desc: 'Per-book read permissions', group: 'People' },
  { id: 'email', label: 'Email / SMTP', icon: '✉️', desc: 'Outgoing app mail', group: 'Settings' }
];
const GROUPS = ['Overview', 'Content', 'Monetisation', 'People', 'Settings'];

export default function Admin() {
  const { me, signOut } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('dashboard');
  const [open, setOpen] = useState(false);    // mobile drawer

  useEffect(() => { setOpen(false); }, [tab]);

  const current = NAV.find(n => n.id === tab);

  return (
    <div className="admin-shell">
      {open && <div className="admin-overlay" onClick={() => setOpen(false)}/>}

      <aside className={'admin-sidebar' + (open ? ' open' : '')}>
        <div className="sb-brand">
          ☕ Java Library
          <span>Admin panel</span>
        </div>

        <nav className="admin-sb-nav">
          {GROUPS.map(g => (
            <div key={g}>
              <div className="sb-group">{g}</div>
              {NAV.filter(n => n.group === g).map(n => (
                <button key={n.id}
                        className={'sb-item' + (tab === n.id ? ' active' : '')}
                        onClick={() => setTab(n.id)}>
                  <span className="ico">{n.icon}</span>
                  <span className="sb-label">
                    <b>{n.label}</b>
                    <i>{n.desc}</i>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sb-foot">
          <Link className="btn ghost sb-back" to="/dashboard">← Back to library</Link>
          <button className="btn ghost sb-signout"
                  onClick={async () => { await signOut(); nav('/login'); }}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-burger" aria-label="Open admin menu"
                  onClick={() => setOpen(o => !o)}>☰</button>
          <div className="atb-title">
            <h2>{current.icon} {current.label}</h2>
            <p>{current.desc}</p>
          </div>
          <div className="atb-right">
            <span className="chip admin">admin</span>
            <span className="atb-user">{me?.profile?.display_name || me?.profile?.email || ''}</span>
          </div>
        </header>

        <div className="admin-content">
          {tab === 'dashboard' && <DashboardPanel/>}
          {tab === 'books' && <BooksPanel/>}
          {tab === 'plans' && <PlansPanel/>}
          {tab === 'users' && <UsersPanel/>}
          {tab === 'grants' && <GrantsPanel/>}
          {tab === 'email' && <EmailPanel/>}
        </div>
      </main>
    </div>
  );
}

function BooksPanel() {
  const [books, setBooks] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState('');
  const [msg, setMsg] = useState('');

  function load() {
    api('/api/admin/books').then(setBooks).catch(e => setErr(e.message));
  }
  useEffect(load, []);   // eslint-disable-line react-hooks/exhaustive-deps

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
      <NewBookForm onCreated={load}/>
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

function EmailPanel() {
  const [f, setF] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api('/api/admin/smtp').then(d => {
      setConfigured(!!d.configured);
      setF({
        host: d.host || '', port: d.port || 587, secure: !!d.secure,
        username: d.username || '', password: '',
        from_email: d.from_email || '', from_name: d.from_name || ''
      });
    }).catch(e => setErr(e.message));
  }, []);

  function set(field, value) { setF(x => ({ ...x, [field]: value })); }

  function useGmailDefaults() {
    setF(x => ({ ...x, host: 'smtp.gmail.com', port: 587, secure: false }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    try {
      await api('/api/admin/smtp', {
        method: 'PUT',
        body: JSON.stringify({
          host: f.host, port: Number(f.port), secure: f.secure,
          username: f.username, password: f.password,
          from_email: f.from_email, from_name: f.from_name
        })
      });
      setMsg('SMTP settings saved ✓');
      setConfigured(true);
      set('password', '');
    } catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  }

  async function sendTest() {
    setTesting(true); setMsg(''); setErr('');
    try {
      const r = await api('/api/admin/smtp/test', {
        method: 'POST',
        body: JSON.stringify(testTo ? { to: testTo } : {})
      });
      setMsg(`Test email sent to ${r.sent_to} ✓ — check the inbox (and spam folder).`);
    } catch (ex) { setErr(ex.message); }
    finally { setTesting(false); }
  }

  if (!f) return <div className="loading-block"><div className="spin"/><span>Loading email settings…</span></div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="muted fs13">
          This SMTP config is used only for emails <em>this app</em> sends (like the learning-reminder
          feature). It has no effect on Supabase's own signup-confirmation / password-reset emails —
          those are configured separately in the Supabase Dashboard under
          Authentication → Settings → SMTP Settings.
        </p>
      </div>
      {err && <div className="errbox">{err}</div>}
      {msg && <div className="infobox">{msg}</div>}
      <form className="card admin-row" onSubmit={save}>
        <div className="admin-row-grid">
          <label className="field"><span>SMTP host</span>
            <input value={f.host} placeholder="smtp.gmail.com" onChange={e => set('host', e.target.value)}/>
          </label>
          <label className="field"><span>Port</span>
            <input type="number" value={f.port} onChange={e => set('port', e.target.value)}/>
          </label>
          <label className="field checkbox-field">
            <input type="checkbox" checked={f.secure} onChange={e => set('secure', e.target.checked)}/>
            <span>Use implicit TLS (port 465) — leave off for STARTTLS on 587</span>
          </label>
          <label className="field"><span>Username (e.g. your Gmail address)</span>
            <input value={f.username} onChange={e => set('username', e.target.value)}/>
          </label>
          <label className="field">
            <span>{configured ? 'Password / app password (leave blank to keep current)' : 'Password / app password'}</span>
            <input type="password" value={f.password} autoComplete="new-password"
                   onChange={e => set('password', e.target.value)}/>
          </label>
          <label className="field"><span>From email</span>
            <input type="email" value={f.from_email} onChange={e => set('from_email', e.target.value)}/>
          </label>
          <label className="field"><span>From name</span>
            <input value={f.from_name} onChange={e => set('from_name', e.target.value)}/>
          </label>
        </div>
        <p className="muted fs13">
          Using Gmail: create an <strong>App Password</strong> at myaccount.google.com/apppasswords
          (requires 2-Step Verification on the Google account) — your normal Gmail password will not
          work here. Gmail also requires "From email" to match the signed-in account.{' '}
          <button type="button" className="btn ghost" onClick={useGmailDefaults}>Use Gmail defaults</button>
        </p>
        <button className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save SMTP settings'}</button>
      </form>
      <div className="card admin-row" style={{ marginTop: 16 }}>
        <h4>Send a test email</h4>
        <div className="admin-row-grid">
          <label className="field"><span>Send to (blank = your own account email)</span>
            <input type="email" value={testTo} onChange={e => setTestTo(e.target.value)}/>
          </label>
        </div>
        <button className="btn" disabled={testing || !configured} onClick={sendTest}>
          {testing ? 'Sending…' : 'Send test email'}
        </button>
        {!configured && <p className="muted fs13">Save your SMTP settings first.</p>}
      </div>
    </div>
  );
}

/* ---------- tiny dependency-free SVG bar chart ---------- */
function BarChart({ series, color, money }) {
  const W = 640, H = 168, PAD = 10;
  const max = Math.max(1, ...series.map(s => s.value));
  const bw = Math.max(2, (W - PAD * 2) / series.length - 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Bar chart">
      {series.map((s, i) => {
        const h = (s.value / max) * (H - 38);
        const x = PAD + i * ((W - PAD * 2) / series.length);
        const y = H - 26 - h;
        return (
          <g key={s.label}>
            <rect x={x} y={y} width={bw} height={Math.max(h, 1)} rx={2.5}
                  fill={color} opacity={s.value ? 0.95 : 0.12}>
              <title>{`${s.label} · ${money ? '₹' + (s.value / 100).toLocaleString('en-IN') : s.value}`}</title>
            </rect>
            {i % 2 === 0 &&
              <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="9"
                    fill="var(--ink-dim)">{s.label.split(' ')[0]}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function DashboardPanel() {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/admin/stats').then(setSt).catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="errbox">{err}</div>;
  if (!st) return <div className="loading-block"><div className="spin"/><span>Crunching the numbers…</span></div>;

  const t = st.totals;
  const inr = n => '₹' + (n / 100).toLocaleString('en-IN');
  const rev = (st.sales_series || []).map(s => ({ label: s.label, value: s.revenue_paise }));
  const sign = (st.signups_series || []).map(s => ({ label: s.label, value: s.signups }));

  return (
    <div>
      <div className="dash-stats">
        <div className="stat-card">
          <div className="stat-head"><span className="stat-ico">🧑</span><div className="stat-label">Readers</div></div>
          <div className="stat-num">{t.users}</div>
        </div>
        <div className="stat-card">
          <div className="stat-head"><span className="stat-ico">📚</span><div className="stat-label">Books published</div></div>
          <div className="stat-num">{t.published_books}<span className="stat-sub">/{t.books} total</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-head"><span className="stat-ico">✅</span><div className="stat-label">Active subscriptions</div></div>
          <div className="stat-num">{t.active_subs}</div>
        </div>
        <div className="stat-card">
          <div className="stat-head"><span className="stat-ico">💰</span><div className="stat-label">All-time revenue</div></div>
          <div className="stat-num">{inr(t.total_revenue_paise)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-head"><span className="stat-ico">📅</span><div className="stat-label">Revenue this month</div></div>
          <div className="stat-num">{inr(t.month_revenue_paise)}</div>
        </div>
      </div>

      <div className="dash-charts">
        <div className="card chart-card">
          <h4>📈 Sales — last 14 days</h4>
          <BarChart series={rev} color="var(--accent)" money/>
        </div>
        <div className="card chart-card">
          <h4>👥 New signups — last 14 days</h4>
          <BarChart series={sign} color="var(--gold)" money={false}/>
        </div>
      </div>

      <div className="dash-cols">
        <div className="card chart-card">
          <h4>🔥 Top books (one-time purchases)</h4>
          {st.top_books.length === 0 && <p className="muted">No one-time purchases yet.</p>}
          {st.top_books.map(b => (
            <div key={b.slug} className="top-book-row">
              <span style={{ fontSize: 22 }}>{b.cover_emoji}</span>
              <span className="leaderboard-name">{b.title}</span>
              <span className="muted fs13">{b.purchases} sale{b.purchases === 1 ? '' : 's'}</span>
              <span className="leaderboard-points">{inr(b.revenue_paise)}</span>
            </div>
          ))}
        </div>
        <div className="card chart-card">
          <h4>🧾 Recent transactions</h4>
          <div className="tx-table">
            {st.recent_transactions.map(tx => (
              <div key={tx.id} className="tx-row">
                <div className="tx-left">
                  <b>{tx.user_name || tx.user_email || 'Anonymous'}</b>
                  <div className="muted fs13">{tx.item} · {tx.kind.replace('_', ' ')}</div>
                </div>
                <div className="tx-right">
                  <span className="chip premium">₹{(tx.amount_paise / 100).toLocaleString('en-IN')}</span>
                  <span className="muted fs13">{new Date(tx.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {st.recent_transactions.length === 0 && <p className="muted">No transactions yet — subscribers and purchases appear here.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- add a brand-new book shell directly from the panel ---------- */
function NewBookForm({ onCreated }) {
  const [f, setF] = useState({ title: '', slug: '', subtitle: '', author: '', cover_emoji: '📕', tier: 'free', price: '', published: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  async function create(e) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      await api('/api/admin/books', {
        method: 'POST',
        body: JSON.stringify({
          title: f.title, slug: f.slug || undefined,
          subtitle: f.subtitle, author: f.author,
          cover_emoji: f.cover_emoji, tier: f.tier,
          price_paise: Math.max(0, Math.round(Number(f.price) || 0) * 100),
          published: f.published
        })
      });
      setF({ title: '', slug: '', subtitle: '', author: '', cover_emoji: '📕', tier: 'free', price: '', published: false });
      setMsg('Book created ✓ — import its spreads with the CLI script later.');
      onCreated?.();
    } catch (ex) { setMsg(ex.message); }
    finally { setBusy(false); }
  }

  return (
    <form className="card newbook-form" onSubmit={create}>
      <h4 style={{ marginTop: 0 }}>✨ Add a new book</h4>
      {msg && <div className="infobox">{msg}</div>}
      <div className="admin-row-grid">
        <label className="field"><span>Title *</span>
          <input required value={f.title} onChange={e => set('title', e.target.value)}/>
        </label>
        <label className="field"><span>Slug (optional — auto-generated)</span>
          <input placeholder="my-new-book" value={f.slug} onChange={e => set('slug', e.target.value)}/>
        </label>
        <label className="field"><span>Subtitle</span>
          <input value={f.subtitle} onChange={e => set('subtitle', e.target.value)}/>
        </label>
        <label className="field"><span>Author</span>
          <input value={f.author} onChange={e => set('author', e.target.value)}/>
        </label>
        <label className="field"><span>Cover emoji</span>
          <input maxLength={8} value={f.cover_emoji} onChange={e => set('cover_emoji', e.target.value)}/>
        </label>
        <label className="field"><span>Tier</span>
          <select value={f.tier} onChange={e => set('tier', e.target.value)}>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
        </label>
        <label className="field"><span>Price (₹, 0 = not sold individually)</span>
          <input type="number" min="0" value={f.price} onChange={e => set('price', e.target.value)}/>
        </label>
        <label className="field checkbox-field">
          <input type="checkbox" checked={f.published} onChange={e => set('published', e.target.checked)}/>
          <span>Publish now</span>
        </label>
      </div>
      <button className="btn primary" disabled={busy} style={{ marginTop: 12 }}>
        {busy ? 'Creating…' : 'Create book'}
      </button>
    </form>
  );
}

/* ---------- global read-permission grants manager ---------- */
function GrantsPanel() {
  const [grants, setGrants] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  function load() {
    api('/api/admin/grants').then(setGrants).catch(e => setErr(e.message));
  }
  useEffect(load, []);   // eslint-disable-line react-hooks/exhaustive-deps

  async function revoke(g) {
    setBusy(g.id); setMsg('');
    try {
      await api('/api/admin/grants', {
        method: 'DELETE', body: JSON.stringify({ user_id: g.user_id, book_id: g.book_id })
      });
      setMsg('Revoked read access');
      load();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(''); }
  }

  if (err) return <div className="errbox">{err}</div>;

  return (
    <div>
      <p className="muted">
        Grant a reader access to a single book — no subscription or payment needed.
        Use the <b>Users</b> tab to grant/revoke per user, or manage everything here.
      </p>
      {msg && <div className="infobox">{msg}</div>}
      {!grants
        ? <div className="loading-block"><div className="spin"/><span>Loading grants…</span></div>
        : <div className="admin-table">
            {grants.map(g => (
              <div key={g.id} className="card admin-row admin-user-row">
                <div style={{ flex: 1 }}>
                  <b>{g.user_name || g.user_email || '—'}</b>
                  <div className="muted fs13">{g.book_title} · {g.book_slug}</div>
                </div>
                <span className="chip premium">{g.cover_emoji} granted</span>
                <span className="muted fs13">{new Date(g.created_at).toLocaleDateString()}</span>
                <button className="btn danger" disabled={busy === g.id}
                        onClick={() => revoke(g)}>Revoke</button>
              </div>
            ))}
            {grants.length === 0 && <div className="infobox">No read grants yet — grant one from the Users tab.</div>}
          </div>}
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState(null);
  const [books, setBooks] = useState([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [grantSel, setGrantSel] = useState({});   // user_id -> book_id

  function load() {
    api('/api/admin/users' + (q ? `?q=${encodeURIComponent(q)}` : ''))
      .then(setUsers).catch(e => setErr(e.message));
  }
  useEffect(load, []);   // eslint-disable-line react-hooks/exhaustive-deps

  /* published books are the candidates for read-permission grants */
  useEffect(() => {
    api('/api/admin/books')
      .then(bs => setBooks((bs || []).filter(b => b.published)))
      .catch(() => {});
  }, []);

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

  async function grantRead(u) {
    const book_id = grantSel[u.id];
    if (!book_id) return;
    setBusy(u.id); setMsg('');
    try {
      await api('/api/admin/grants', {
        method: 'POST', body: JSON.stringify({ user_id: u.id, book_id })
      });
      setMsg(`Granted read access to ${u.display_name || u.email}`);
      load();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(''); }
  }

  async function revokeRead(u, book_id) {
    setBusy(u.id); setMsg('');
    try {
      await api('/api/admin/grants', {
        method: 'DELETE', body: JSON.stringify({ user_id: u.id, book_id })
      });
      setMsg('Revoked read access');
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
                <div className="admin-grants">
                  <span className="muted fs13">Read access:</span>
                  <div className="grant-chips">
                    {(u.granted_books || []).map(gb => (
                      <span key={gb.book_id} className="chip premium grant-chip">
                        {gb.cover_emoji} {gb.title}
                        <button type="button" className="chip-x" title="Revoke"
                                disabled={busy === u.id}
                                onClick={() => revokeRead(u, gb.book_id)}>✕</button>
                      </span>
                    ))}
                    {(!u.granted_books || u.granted_books.length === 0)
                      && <span className="muted fs13">none — grant a book below</span>}
                  </div>
                  <div className="admin-grant-box">
                    <select value={grantSel[u.id] || ''}
                            onChange={e => setGrantSel(s => ({ ...s, [u.id]: e.target.value }))}>
                      <option value="">Grant read access…</option>
                      {books.map(bb => <option key={bb.id} value={bb.id}>{bb.cover_emoji} {bb.title}</option>)}
                    </select>
                    <button className="btn" disabled={busy === u.id || !grantSel[u.id]}
                            onClick={() => grantRead(u)}>Grant</button>
                  </div>
                </div>
              </div>
            ))}
            {users.length === 0 && <div className="infobox">No users match.</div>}
          </div>}
    </div>
  );
}
