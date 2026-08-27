import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { entitlements } from '../middleware/rbac.js';
import { admin } from '../lib/supabase.js';

const r = Router();
r.use(requireAuth);

const PROVIDER = process.env.BILLING_PROVIDER || 'sandbox';

/* GET /api/billing/plans */
r.get('/plans', async (_req, res) => {
  const { data, error } = await admin.from('plans')
    .select('*').order('price_paise');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* GET /api/billing/subscription — current active row or null */
r.get('/subscription', async (req, res) => {
  const e = await entitlements(req.profile, admin);
  res.json({ subscription: e.subscription, premium: e.premium });
});

/* POST /api/billing/checkout {plan_id}
 * SANDBOX gateway: activates instantly without charging. The Stripe/Razorpay
 * seam is deliberately narrow — replace the mutation below with a redirect to
 * the gateway's checkout session; their WEBHOOK then performs this exact
 * subscription upsert after payment confirmation. Everything downstream
 * (entitlements, RLS) already reacts to this one table. */
r.post('/checkout', async (req, res) => {
  const planId = String(req.body?.plan_id || '');
  if (!planId || planId === 'free')
    return res.status(400).json({ error: 'Choose a paid plan to check out' });

  const { data: plan } = await admin.from('plans')
    .select('*').eq('plan_id', planId).maybeSingle();
  if (!plan || plan.plan_id === 'free')
    return res.status(400).json({ error: 'Unknown plan' });
  if (plan.interval_days <= 0)
    return res.status(400).json({ error: 'Plan has no billing interval' });

  const uid = req.user.id;

  // idempotent: already active on this very plan → confirm instead of err
  const { data: current } = await admin.from('subscriptions')
    .select('*').eq('user_id', uid).eq('status', 'active')
    .gt('current_end', new Date().toISOString()).maybeSingle();
  if (current && current.plan_id === planId)
    return res.json({ idempotent: true, subscription: current });

  const start = new Date();
  const end = new Date(start.getTime() +
                       plan.interval_days * 24 * 60 * 60 * 1000);

  // close any previous live subscription, then open the new one
  await admin.from('subscriptions')
    .update({ status: 'canceled', canceled_at: start.toISOString() })
    .eq('user_id', uid).eq('status', 'active');

  let created;
  try {
    ({ data: created } = await admin.from('subscriptions').insert({
      user_id: uid,
      plan_id: plan.plan_id,
      status: 'active',
      provider: PROVIDER,
      provider_ref: `${PROVIDER}_${Date.now().toString(36)}_${uid.slice(0, 8)}`,
      current_start: start.toISOString(),
      current_end: end.toISOString()
    }).select().single());
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('23505')) {                     // raced with another tab
      const { data: again } = await admin.from('subscriptions')
        .select('*').eq('user_id', uid).eq('status', 'active').maybeSingle();
      return res.json({ idempotent: true, subscription: again });
    }
    return res.status(500).json({ error: msg });
  }

  console.log(`[BILLING] ${uid} → ${planId} (${PROVIDER}) until ${end.toISOString()}`);
  res.status(201).json({
    subscription: created,
    plan: { plan_id: plan.plan_id, name: plan.name,
            price_paise: plan.price_paise },
    message: PROVIDER === 'sandbox'
      ? 'Sandbox checkout — no card was charged.'
      : 'Payment confirmed by gateway.'
  });
});

/* POST /api/billing/purchase/:slug — one-time unlock for a single priced
 * book. SANDBOX gateway, same idempotent shape as /checkout above: check
 * for an existing purchase first, insert, and fall back to a re-select on
 * a unique-constraint race (two tabs/a retry hitting this at once). */
r.post('/purchase/:slug', async (req, res) => {
  const { data: book } = await admin.from('books')
    .select('id,slug,title,published,price_paise')
    .eq('slug', req.params.slug).maybeSingle();
  if (!book || !book.published) return res.status(404).json({ error: 'Book not found' });
  if (!book.price_paise) return res.status(400).json({ error: 'This book is not sold individually' });

  const uid = req.user.id;

  const { data: current } = await admin.from('book_purchases')
    .select('*').eq('user_id', uid).eq('book_id', book.id).maybeSingle();
  if (current) return res.json({ idempotent: true, purchase: current });

  let created;
  try {
    ({ data: created } = await admin.from('book_purchases').insert({
      user_id: uid,
      book_id: book.id,
      price_paise_paid: book.price_paise,
      provider: PROVIDER,
      provider_ref: `${PROVIDER}_${Date.now().toString(36)}_${uid.slice(0, 8)}`
    }).select().single());
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('23505')) {                     // raced with another tab
      const { data: again } = await admin.from('book_purchases')
        .select('*').eq('user_id', uid).eq('book_id', book.id).maybeSingle();
      return res.json({ idempotent: true, purchase: again });
    }
    return res.status(500).json({ error: msg });
  }

  console.log(`[BILLING] ${uid} bought "${book.slug}" for ₹${book.price_paise / 100} (${PROVIDER})`);
  res.status(201).json({
    purchase: created,
    book: { slug: book.slug, title: book.title },
    message: PROVIDER === 'sandbox'
      ? 'Sandbox purchase — no card was charged.'
      : 'Payment confirmed by gateway.'
  });
});

/* POST /api/billing/cancel — access continues until current_end (no refunds) */
r.post('/cancel', async (req, res) => {
  const { data: sub } = await admin.from('subscriptions')
    .select('id,current_end').eq('user_id', req.user.id)
    .eq('status', 'active').maybeSingle();
  if (!sub) return res.status(404).json({ error: 'No active subscription' });
  const { error } = await admin.from('subscriptions')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', sub.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, access_until: sub.current_end });
});

export default r;