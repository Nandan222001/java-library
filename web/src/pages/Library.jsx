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
      <header style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1>Your library 📚</h1>
        <p className="muted" style={{ maxWidth: '600px' }}>
          Theory on the left page, drills and dry-runs on the right. Tap a cover to open the reader and begin your journey.
        </p>
      </header>

      {buyMsg && <div className={buyMsg.t === 'ok' ? 'infobox' : 'errbox'}>{buyMsg.m}</div>}

      <div className="grid-books">
        {books.map(b => (
          <div key={b.id} className="card book-card"
               onClick={() => nav(`/read/${b.slug}${b.continue_flips ? `?p=${b.continue_flips}` : ''}`)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="emoji">{b.cover_emoji}</span>
              {b.tier === 'premium'
                ? <span className={'chip premium'}>{b.locked ? '🔒 Premium' : 'Premium ✓'}</span>
                : <span className="chip free">Free</span>}
            </div>
            
            <div style={{ flex: 1 }}>
              <h3>{b.title}</h3>
              <p className="sub">{b.subtitle}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: '14px', fontFamily: 'Fira Code' }}>{b.author || 'Anonymous'}</span>
                {b.continue_flips > 0 && (
                  <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    Resume p.{b.continue_flips * 2}
                  </span>
                )}
              </div>

              {b.locked && b.price_paise > 0 ? (
                <button className="btn primary" style={{ width: '100%', padding: '10px' }}
                        disabled={buying === b.id}
                        onClick={e => buy(e, b)}>
                  {buying === b.id ? 'Unlocking…' : `Unlock for ₹${(b.price_paise / 100).toLocaleString('en-IN')}`}
                </button>
              ) : (
                <Link to={`/books/${b.slug}/practice`} className="btn"
                      style={{ width: '100%', padding: '10px' }}
                      onClick={e => e.stopPropagation()}>
                  🎯 Practice Mode
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {books.length === 0 && (
        <div className="infobox" style={{ marginTop: 'var(--space-xl)' }}>
          No published books yet — run the import script or add one via the admin panel.
        </div>
      )}

      <footer style={{ marginTop: 'var(--space-3xl)', borderTop: '1px solid var(--line)', paddingTop: 'var(--space-xl)' }}>
        <p className="muted" style={{ fontSize: '14px' }}>
          <strong>Pro Tip:</strong> Use the <strong>☆ Mark</strong> feature inside the reader to save key concepts. Bookmarks are easily accessible from the Contents drawer.
        </p>
      </footer>
    </div>
  );
}
