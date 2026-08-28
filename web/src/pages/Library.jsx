import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { openRazorpayCheckout } from '../lib/razorpay.js';

export default function Library() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [books, setBooks] = useState(null);
  const [err, setErr] = useState('');
  const [buying, setBuying] = useState('');
  const [buyMsg, setBuyMsg] = useState(null);
  const [pg, setPg] = useState(null);        // /api/billing/config

  function load() {
    return api('/api/books').then(setBooks).catch(e => setErr(e.message));
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { api('/api/billing/config').then(setPg).catch(() => {}); }, []);

  async function buy(e, b) {
    e.stopPropagation();
    setBuying(b.id); setBuyMsg(null);
    try {
      if (pg?.provider === 'razorpay' && pg.razorpay_key_id) {
        /* real Razorpay order → hosted checkout → server-verified signature */
        const o = await api('/api/billing/order',
          { method: 'POST', body: JSON.stringify({ book_slug: b.slug }) });
        await openRazorpayCheckout({
          key: o.key_id, order_id: o.order_id,
          amount: o.amount_paise, currency: o.currency,
          description: b.title,
          prefill: { email: user?.email || '' },
          onSuccess: async rz => {
            try {
              await api('/api/billing/verify', { method: 'POST', body: JSON.stringify({
                razorpay_order_id: rz.razorpay_order_id,
                razorpay_payment_id: rz.razorpay_payment_id,
                razorpay_signature: rz.razorpay_signature
              }) });
              setBuyMsg({ t: 'ok', m: `Unlocked "${b.title}" 🎉` });
              await load();
            } catch (ex) {
              setBuyMsg({ t: 'err', m: `Payment captured but activation failed: ${ex.message}` });
            }
          },
          onFailure: () => setBuyMsg({ t: 'err', m: 'Payment cancelled or failed — no charge was made.' })
        });
      } else {
        await api(`/api/billing/purchase/${b.slug}`, { method: 'POST' });
        setBuyMsg({ t: 'ok', m: `Unlocked "${b.title}" 🎉` });
        await load();
      }
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
