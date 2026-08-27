import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Pricing() {
  const { me, refreshMe } = useAuth();
  const [plans, setPlans] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const activeId = me?.subscription?.plan_id;

  useEffect(() => {
    api('/api/billing/plans').then(setPlans).catch(e => setMsg({ t: 'err', m: e.message }));
  }, []);

  async function checkout(plan_id) {
    setBusy(plan_id); setMsg(null);
    try {
      const r = await api('/api/billing/checkout',
        { method: 'POST', body: JSON.stringify({ plan_id }) });
      await refreshMe();
      setMsg({ t: 'ok',
        m: r.idempotent ? `Already subscribed to ${plan_id}.`
                        : `${r.plan.name} activated 🎉 ${r.message}` });
    } catch (e) {
      setMsg({ t: 'err', m: e.status === 402 ? e.message : e.message });
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
        Sandbox billing — no card is charged while payments are in test mode.
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
                 className={'card plan-card' + (premium ? '' : '')}
                 style={premium ? { borderColor: '#c9a22788' } : undefined}>
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