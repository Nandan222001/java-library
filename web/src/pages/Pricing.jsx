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
    <div className="container" style={{ maxWidth: 960 }}>
      <h1 style={{ textAlign: 'center' }}>Plans &amp; Pricing</h1>
      <p className="muted" style={{ textAlign: 'center' }}>
        {pg?.provider === 'razorpay'
          ? 'Payments are processed securely by Razorpay.'
          : 'Sandbox billing — no card is charged while payments are in test mode.'}
      </p>

      {me?.entitlements?.staff &&
        <div className="infobox" style={{ textAlign: 'center' }}>
          Your account has staff privileges — all books are unlocked automatically.
        </div>}

      {msg && <div className={msg.t === 'ok' ? 'infobox' : 'errbox'} style={{ maxWidth: 560, margin: '0 auto 10px' }}>{msg.m}</div>}

      <div className="price-grid">
        {plans.map(p => {
          const current = activeId === p.plan_id ||
            (p.plan_id === 'free' && !activeId);
          const premium = p.price_paise > 0;
          return (
            <div key={p.plan_id}
                 className={'card plan-card' + (premium ? ' featured' : '')}>
              <h3>{p.name}</h3>
              <div className="price">
                {p.price_paise === 0 ? '₹0'
                  : `₹${(p.price_paise / 100).toLocaleString('en-IN')}`}
              </div>
              <div className="muted">{premium
                ? `per ${p.interval_days >= 365 ? 'year' : 'month'}`
                : 'forever'}</div>
              <ul>
                {(p.features || []).map(f => <li key={f}>{f}</li>)}
              </ul>
              {current
                ? <button className="btn" disabled>✓ Current plan</button>
                : premium
                  ? <button className="btn primary" disabled={!!busy}
                            onClick={() => checkout(p.plan_id)}>
                      {busy === p.plan_id ? 'Processing…' : 'Subscribe'}
                    </button>
                  : <Link to="/library" className="btn ghost">Browse free books</Link>}
            </div>
          );
        })}
      </div>

      {me?.subscription &&
        <p className="muted" style={{ textAlign: 'center', marginTop: 22 }}>
          Active until{' '}
          {new Date(me.subscription.current_end).toLocaleDateString()} ·{' '}
          <button className="btn danger"
                  disabled={busy === 'cancel'} onClick={cancel}>
            Cancel auto-renewal
          </button>
        </p>}
    </div>
  );
}