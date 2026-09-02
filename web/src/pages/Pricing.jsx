import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { openRazorpayCheckout } from '../lib/razorpay.js';

export default function Pricing() {
  const { me, user, refreshMe } = useAuth();
  const [plans, setPlans] = useState(null);
  const [pg, setPg] = useState(null);        // /api/billing/config
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const activeId = me?.subscription?.plan_id;

  useEffect(() => {
    api('/api/billing/plans').then(setPlans).catch(e => setMsg({ t: 'err', m: e.message }));
    api('/api/billing/config').then(setPg).catch(() => {});
  }, []);

  async function checkout(plan_id) {
    setBusy(plan_id); setMsg(null);
    try {
      if (pg?.provider === 'razorpay' && pg.razorpay_key_id) {
        /* real Razorpay order → hosted checkout → server-verified signature */
        const o = await api('/api/billing/order',
          { method: 'POST', body: JSON.stringify({ plan_id }) });
        await openRazorpayCheckout({
          key: o.key_id, order_id: o.order_id,
          amount: o.amount_paise, currency: o.currency,
          description: 'Java Library subscription',
          prefill: { email: user?.email || '' },
          onSuccess: async rz => {
            try {
              await api('/api/billing/verify', { method: 'POST', body: JSON.stringify({
                razorpay_order_id: rz.razorpay_order_id,
                razorpay_payment_id: rz.razorpay_payment_id,
                razorpay_signature: rz.razorpay_signature
              }) });
              await refreshMe();
              setMsg({ t: 'ok', m: 'Payment successful — Premium unlocked 🎉' });
            } catch (ex) {
              setMsg({ t: 'err', m: `Payment captured but activation failed: ${ex.message}` });
            }
          },
          onFailure: () => setMsg({ t: 'err', m: 'Payment cancelled or failed — no charge was made.' })
        });
      } else {
        const r = await api('/api/billing/checkout',
          { method: 'POST', body: JSON.stringify({ plan_id }) });
        await refreshMe();
        setMsg({ t: 'ok',
          m: r.idempotent ? `Already subscribed to ${plan_id}.`
                          : `${r.plan.name} activated 🎉 ${r.message}` });
      }
    } catch (e) {
      setMsg({ t: 'err', m: e.message });
    } finally {
      setBusy('');
    }
  }

  async function cancel() {
    if (!confirm('Cancel your subscription? You keep access until the period ends.')) return;
    setBusy('cancel'); setMsg(null);
    try {
      const r = await api('/api/billing/cancel', { method: 'POST' });
      await refreshMe();
      setMsg({ t: 'ok', m: `Canceled. Access until ${new Date(r.access_until).toLocaleDateString()}.` });
    } catch (e) {
      setMsg({ t: 'err', m: e.message });
    } finally {
      setBusy('');
    }
  }

  if (!plans) return <div className="container loading-block"><div className="spin"/><span>Loading plans…</span></div>;

  return (
    <div className="container" style={{ maxWidth: 1080 }}>
      <header style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '12px' }}>Choose your path</h1>
        <p className="muted" style={{ fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
          {pg?.provider === 'razorpay'
            ? 'Unlock the full library and mastering tools. Secure payments via Razorpay.'
            : 'Sandbox billing active — enjoy full access in test mode with no real charges.'}
        </p>
      </header>

      {me?.entitlements?.staff && (
        <div className="infobox" style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 40px' }}>
          <strong>Staff Account:</strong> Every book and feature is automatically unlocked for you.
        </div>
      )}

      {msg && (
        <div className={msg.t === 'ok' ? 'infobox' : 'errbox'} style={{ maxWidth: 560, margin: '0 auto 20px' }}>
          {msg.m}
        </div>
      )}

      <div className="price-grid">
        {plans.map(p => {
          const current = activeId === p.plan_id || (p.plan_id === 'free' && !activeId);
          const isFeatured = p.price_paise > 0;
          return (
            <div 
              key={p.plan_id}
              className={`card plan-card ${isFeatured ? 'featured' : ''}`}
            >
              {isFeatured && (
                <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Recommended
                </div>
              )}
              <h3 style={{ fontSize: '1.6rem' }}>{p.name}</h3>
              <div className="price">
                {p.price_paise === 0 ? '₹0' : `₹${(p.price_paise / 100).toLocaleString('en-IN')}`}
              </div>
              <div className="muted" style={{ marginBottom: '24px' }}>
                {p.price_paise === 0 ? 'for casual reading' : `per ${p.interval_days >= 365 ? 'year' : 'month'}`}
              </div>
              
              <ul style={{ flex: 1 }}>
                {(p.features || []).map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>

              <div style={{ marginTop: '24px' }}>
                {current ? (
                  <button className="btn" disabled style={{ width: '100%', opacity: 0.8 }}>
                    ✓ Current Plan
                  </button>
                ) : isFeatured ? (
                  <button 
                    className="btn primary" 
                    disabled={!!busy}
                    style={{ width: '100%' }}
                    onClick={() => checkout(p.plan_id)}
                  >
                    {busy === p.plan_id ? 'Processing…' : 'Get Started'}
                  </button>
                ) : (
                  <Link to="/library" className="btn ghost" style={{ width: '100%' }}>
                    Browse Library
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {me?.subscription && (
        <footer style={{ textAlign: 'center', marginTop: '60px', borderTop: '1px solid var(--line)', paddingTop: '40px' }}>
          <p className="muted">
            Subscription active until <strong>{new Date(me.subscription.current_end).toLocaleDateString()}</strong>
          </p>
          <button 
            className="btn danger ghost"
            style={{ marginTop: '12px' }}
            disabled={busy === 'cancel'} 
            onClick={cancel}
          >
            Cancel auto-renewal
          </button>
        </footer>
      )}
    </div>
  );
}
