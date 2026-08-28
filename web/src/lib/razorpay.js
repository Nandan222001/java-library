/* Thin Razorpay Checkout loader. The checkout popup is Razorpay's hosted
 * widget — we only feed it the order created by POST /api/billing/order. */

let scriptPromise = null;

export function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay checkout'));
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/** Open the checkout modal. `onSuccess` receives the Razorpay response
 *  ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) which the
 *  caller must hand back to POST /api/billing/verify for server-side
 *  signature verification + activation. */
export async function openRazorpayCheckout({
  key, order_id, amount, currency = 'INR',
  name = 'Java Library', description = '',
  prefill = {}, onSuccess, onFailure
}) {
  await loadRazorpayScript();
  const rzp = new window.Razorpay({
    key,
    amount,
    currency,
    name,
    description,
    order_id,
    prefill,
    handler: res => onSuccess?.(res),
    modal: { ondismiss: () => onFailure?.() }
  });
  rzp.on('payment.failed', () => onFailure?.());
  rzp.open();
  return rzp;
}