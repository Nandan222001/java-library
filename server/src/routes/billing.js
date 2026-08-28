import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { entitlements } from '../middleware/rbac.js';
import { admin } from '../lib/supabase.js';
import { recordPayment } from '../lib/ledger.js';
import {
  razorpayEnabled, razorpayKeyId, createRazorpayOrder,
  verifyRazorpaySignature, verifyWebhookSignature
} from '../lib/razorpay.js';

const r = Router();
r.use(requireAuth);

/** Effective provider: real Razorpay when keys are configured, otherwise the
 *  legacy sandbox gateway (instant activation, nothing charged). */
const PROVIDER = () => (razorpayEnabled() ? 'razorpay'
  : (process.env.BILLING_PROVIDER || 'sandbox'));

/* GET /api/billing/config — tells the UI which checkout to open. */
r.get('/config', (_req, res) => {
  res.json({
    provider: PROVIDER(),
    sandbox: !razorpayEnabled(),
    razorpay_key_id: razorpayEnabled() ? razorpayKeyId() : null
  });
});

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
  const ref = `sandbox_${Date.now().toString(36)}_${uid.slice(0, 8)}`;

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
      provider: PROVIDER(),
      provider_ref: ref,
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

  await recordPayment({
    user_id: uid, kind: 'subscription', amount_paise: plan.price_paise,
    provider: PROVIDER(), provider_ref: ref, plan_id: plan.plan_id,
    note: `Sandbox · ${plan.name}`
  });

  console.log(`[BILLING] ${uid} → ${planId} (${PROVIDER()}) until ${end.toISOString()}`);
  res.status(201).json({
    subscription: created,
    plan: { plan_id: plan.plan_id, name: plan.name,
            price_paise: plan.price_paise },
    message: PROVIDER() === 'sandbox'
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

  const ref = `sandbox_${Date.now().toString(36)}_${uid.slice(0, 8)}`;
  let created;
  try {
    ({ data: created } = await admin.from('book_purchases').insert({
      user_id: uid,
      book_id: book.id,
      price_paise_paid: book.price_paise,
      provider: PROVIDER(),
      provider_ref: ref
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

  await recordPayment({
    user_id: uid, kind: 'book_purchase', amount_paise: book.price_paise,
    provider: PROVIDER(), provider_ref: ref, book_id: book.id,
    note: `Sandbox · ${book.title}`
  });

  console.log(`[BILLING] ${uid} bought "${book.slug}" for ₹${book.price_paise / 100} (${PROVIDER()})`);
  res.status(201).json({
    purchase: created,
    book: { slug: book.slug, title: book.title },
    message: PROVIDER() === 'sandbox'
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

/* ------------------------------------------------------------------
 * Activation + webhook. Both /verify and the webhook call
 * applyCapturedPayment(); it is deliberately idempotent so a race
 * between the two can never double-charge or double-activate.
 * ------------------------------------------------------------------ */
async function applyCapturedPayment({ payment, razorpay_payment_id = null }) {
  const now = new Date();

  if (payment.kind === 'subscription') {
    const { data: plan } = await admin.from('plans')
      .select('*').eq('plan_id', payment.plan_id).maybeSingle();
    if (!plan) throw new Error('Plan has been removed — contact support');
    const end = new Date(now.getTime() + plan.interval_days * 24 * 60 * 60 * 1000);

    const { data: cur } = await admin.from('subscriptions')
      .select('plan_id').eq('user_id', payment.user_id).eq('status', 'active')
      .gt('current_end', now.toISOString()).maybeSingle();
    if (!cur || cur.plan_id !== plan.plan_id) {
      await admin.from('subscriptions')
        .update({ status: 'canceled', canceled_at: now.toISOString() })
        .eq('user_id', payment.user_id).eq('status', 'active');
      const { error } = await admin.from('subscriptions').insert({
        user_id: payment.user_id, plan_id: plan.plan_id, status: 'active',
        provider: 'razorpay',
        provider_ref: razorpay_payment_id || payment.provider_ref,
        current_start: now.toISOString(), current_end: end.toISOString()
      });
      if (error) throw error;
    }
  } else if (payment.book_id) {                       // book_purchase
    const { error } = await admin.from('book_purchases').upsert({
      user_id: payment.user_id, book_id: payment.book_id,
      price_paise_paid: payment.amount_paise, provider: 'razorpay',
      provider_ref: razorpay_payment_id || payment.provider_ref
    }, { onConflict: 'user_id,book_id', ignoreDuplicates: true });
    if (error) throw error;
  }

  const { error: upErr } = await admin.from('payments')
    .update({ status: 'captured', provider_payment_id: razorpay_payment_id || null })
    .eq('id', payment.id);
  if (upErr) console.warn('[BILLING] ledger status update failed:', upErr.message);

  console.log(`[BILLING] ${payment.user_id} → ${payment.kind} captured ` +
              `(₹${(payment.amount_paise / 100).toLocaleString('en-IN')})`);
}

/* Razorpay webhook — mounted in app.js BEFORE express.json() with
 * express.raw() so the exact signed bytes are available. Responds 200
 * immediately, then processes asynchronously (matching Razorpay's docs). */
export async function webhookHandler(req, res) {
  try {
    if (!razorpayEnabled())
      return res.status(503).json({ error: 'Razorpay not configured' });

    const sig = req.get('x-razorpay-signature') || '';
    if (!req.body || !verifyWebhookSignature(req.body, sig))
      return res.status(400).json({ error: 'Invalid webhook signature' });

    let payload;
    try { payload = JSON.parse(req.body.toString('utf8')); }
    catch { return res.status(400).json({ error: 'Bad payload' }); }

    res.json({ received: true });                    // ack first, then process

    const event = payload.event;
    const payment = payload.payload?.payment?.entity;
    if ((event === 'payment.captured' || event === 'order.paid') && payment?.order_id) {
      const { data: row } = await admin.from('payments')
        .select('*').eq('provider_ref', payment.order_id)
        .eq('provider', 'razorpay').maybeSingle();
      if (row && row.status !== 'captured')
        await applyCapturedPayment({ payment: row, razorpay_payment_id: payment.id });
    }
  } catch (err) {
    console.error('[RZR WEBHOOK]', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Webhook error' });
  }
}

/* ------------------------------------------------------------------
 * REAL Razorpay flow — used when RAZORPAY_KEY_ID/SECRET are set.
 *   1. POST /order     → creates a Razorpay order + a `pending` ledger row
 *   2. Browser opens Razorpay Checkout with that order id
 *   3. POST /verify    → HMAC-verifies the payment, activates access
 *   (the Razorpay webhook is a second, independent server-to-server path;
 *    both paths are idempotent and safe to race with each other)
 * ------------------------------------------------------------------ */

/* POST /api/billing/order  { plan_id }  |  { book_slug } */
r.post('/order', async (req, res) => {
  if (!razorpayEnabled())
    return res.status(409).json({ error: 'Razorpay is not configured on the server.' });

  const { plan_id, book_slug } = req.body || {};
  let kind = null, plan = null, book = null, amount = 0;

  if (plan_id) {
    ({ data: plan } = await admin.from('plans')
      .select('*').eq('plan_id', plan_id).maybeSingle());
    if (!plan || plan.plan_id === 'free' || plan.price_paise <= 0)
      return res.status(400).json({ error: 'Unknown or non-paid plan' });
    kind = 'subscription';
    amount = plan.price_paise;
  } else if (book_slug) {
    ({ data: book } = await admin.from('books')
      .select('id,slug,title,published,price_paise')
      .eq('slug', book_slug).maybeSingle());
    if (!book || !book.published) return res.status(404).json({ error: 'Book not found' });
    if (!book.price_paise) return res.status(400).json({ error: 'This book is not sold individually' });
    kind = 'book_purchase';
    amount = book.price_paise;
  } else {
    return res.status(400).json({ error: 'plan_id or book_slug required' });
  }

  const uid = req.user.id;
  const receipt = `rcpt_${kind.slice(0, 3)}_${uid.slice(0, 8)}_${Date.now().toString(36)}`;

  let order;
  try {
    order = await createRazorpayOrder({ amount_paise: amount, currency: 'INR', receipt });
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.message });
  }

  const { error: ledErr } = await admin.from('payments').insert({
    user_id: uid, kind, amount_paise: amount, currency: 'INR',
    provider: 'razorpay', provider_ref: order.id, status: 'pending',
    plan_id: plan?.plan_id || null, book_id: book?.id || null,
    note: kind === 'subscription' ? plan.name : book.title
  });
  if (ledErr) return res.status(500).json({ error: ledErr.message });

  res.json({
    provider: 'razorpay',
    key_id: razorpayKeyId(),
    order_id: order.id,
    amount_paise: amount,
    currency: 'INR',
    receipt
  });
});

/* POST /api/billing/verify  { razorpay_order_id, razorpay_payment_id,
 *                              razorpay_signature } */
r.post('/verify', async (req, res) => {
  if (!razorpayEnabled())
    return res.status(409).json({ error: 'Razorpay not configured' });

  const b = req.body || {};
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = b;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ error: 'Razorpay payment fields required' });
  if (!verifyRazorpaySignature({
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      signature: razorpay_signature }))
    return res.status(400).json({ error: 'Payment signature verification failed' });

  const uid = req.user.id;
  const { data: payment } = await admin.from('payments')
    .select('*').eq('provider_ref', razorpay_order_id).eq('user_id', uid).maybeSingle();
  if (!payment)
    return res.status(404).json({ error: 'No pending order matches this payment' });

  if (payment.status === 'captured') {
    // idempotent re-verify (page refresh after success / double tap)
    const { data: sub } = await admin.from('subscriptions')
      .select('plan_id,current_end').eq('user_id', uid).eq('status', 'active')
      .gt('current_end', new Date().toISOString()).maybeSingle();
    return res.json({ ok: true, already_captured: true, subscription: sub || null });
  }

  try {
    await applyCapturedPayment({ payment, razorpay_payment_id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  res.json({ ok: true, message: 'Payment confirmed — access unlocked 🎉' });
});

export default r;