/* Sales ledger — one shared helper used by billing + admin routes so every
 * captured subscription / one-time purchase / admin grant lands in the
 * `payments` table the admin dashboard's graphs read from. */
import { admin } from './supabase.js';

export async function recordPayment({
  user_id, kind, amount_paise = 0, provider = 'sandbox',
  provider_ref = null, provider_payment_id = null,
  plan_id = null, book_id = null, status = 'captured', note = ''
}) {
  const { error } = await admin.from('payments').insert({
    user_id, kind, amount_paise, currency: 'INR',
    provider, provider_ref, provider_payment_id,
    plan_id, book_id, status, note
  });
  if (error) console.warn('[LEDGER] payment insert failed:', error.message);
}