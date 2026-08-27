import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/supabase.js';

export default function Library() {
  const nav = useNavigate();
  const [books, setBooks] = useState(null);
  const [err, setErr] = useState('');
  const [buying, setBuying] = useState('');
  const [buyMsg, setBuyMsg] = useState(null);

  function load() {
    return api('/api/books').then(setBooks).catch(e => setErr(e.message));
  }
  useEffect(() => { load(); }, []);

  async function buy(e, b) {
    e.stopPropagation();
    setBuying(b.id); setBuyMsg(null);
    try {
      await api(`/api/billing/purchase/${b.slug}`, { method: 'POST' });
      setBuyMsg({ t: 'ok', m: `Unlocked "${b.title}" 🎉` });
      await load();
    } catch (ex) {
      setBuyMsg({ t: 'err', m: ex.message });
    } finally {
      setBuying('');
    }
  }

  if (err) return <div className="container"><div className="errbox">{err}</div></div>;
  if (!books) return <div className="loading-block container"><div className="spin"/><span>Loading your library…</span></div>;

  return (
    <div className="container">
      <h1>Your library 📚</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        Theory on the left page, drills and dry-runs on the right. Tap a cover to open the reader.
      </p>
      {buyMsg && <div className={buyMsg.t === 'ok' ? 'infobox' : 'errbox'}>{buyMsg.m}</div>}

      <div className="grid-books" style={{ marginTop: 26 }}>
        {books.map(b => (
          <div key={b.id} className="card book-card"
               onClick={() => nav(`/read/${b.slug}${b.continue_flips ? `?p=${b.continue_flips}` : ''}`)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 38 }}>{b.cover_emoji}</span>
              {b.tier === 'premium'
                ? <span className={'chip premium locked-badge'}>{b.locked ? '🔒 Premium' : 'Premium ✓'}</span>
                : <span className="chip free locked-badge">Free</span>}
            </div>
            <h3 style={{ margin: 0 }}>{b.title}</h3>
            <div className="sub">{b.subtitle}</div>
            <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {b.continue_flips > 0
                && <span className="chip" style={{ background: '#82aaff1f', color: '#b9cfff' }}>
                     ↩ resume p.{b.continue_flips * 2}
                   </span>}
              <span className="muted" style={{ fontSize: 13 }}>{b.author || '—'}</span>
              {b.locked && b.price_paise > 0 &&
                <button className="btn primary" style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 13 }}
                        disabled={buying === b.id}
                        onClick={e => buy(e, b)}>
                  {buying === b.id ? 'Unlocking…' : `Buy for ₹${(b.price_paise / 100).toLocaleString('en-IN')}`}
                </button>}
              {!b.locked &&
                <Link to={`/books/${b.slug}/practice`} className="btn ghost"
                      style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 13 }}
                      onClick={e => e.stopPropagation()}>
                  🎯 Practice
                </Link>}
            </div>
          </div>
        ))}
      </div>

      {books.length === 0 &&
        <div className="infobox">No published books yet — run the import script or add one via /api/admin/import.</div>}

      <p className="muted" style={{ marginTop: 30 }}>
        Tip: press ☆ Mark inside the reader to bookmark spreads; they appear in its Contents drawer.
      </p>
    </div>
  );
}
