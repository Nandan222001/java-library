/* Native-fetch Razorpay client — order creation + signature verification.
 * Zero extra npm dependencies: Node ≥ 18 ships global fetch and crypto is
 * built in. ALL secret-key operations happen here, never in the browser.
 *
 *   RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET set  → real payments enabled.
 *   Neither set                                    → sandbox (instant, free).
 */
import crypto from 'node:crypto';

const KEY_ID = () => process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = () => process.env.RAZORPAY_KEY_SECRET || '';

export const razorpayEnabled = () => !!(KEY_ID() && KEY_SECRET());
export const razorpayKeyId = () => KEY_ID();

function basicAuth() {
  return 'Basic ' + Buffer.from(`${KEY_ID()}:${KEY_SECRET()}`).toString('base64');
}

/** POST /v1/orders — amount is in paise (Razorpay's smallest unit). */
export async function createRazorpayOrder({ amount_paise, currency = 'INR', receipt }) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: basicAuth() },
    body: JSON.stringify({ amount: amount_paise, currency, receipt })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = new Error(
      `Razorpay order failed: ${body?.error?.description || `HTTP ${res.status}`}`);
    e.status = 502;
    throw e;
  }
  return body;                 // { id, amount, currency, …, status: 'created' }
}

/** Client-side payment verification: HMAC-SHA256(order_id|payment_id). */
export function verifyRazorpaySignature({ order_id, payment_id, signature }) {
  const expected = crypto.createHmac('sha256', KEY_SECRET())
    .update(`${order_id}|${payment_id}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(signature || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Webhook verification: HMAC-SHA256 of the EXACT raw request body. */
export function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto.createHmac('sha256', KEY_SECRET())
    .update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(signature || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}