/** Role gate — mount AFTER requireAuth. Example:
 *    router.post('/x', requireAuth, requireRole('admin'), handler) */
export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.profile?.role;
    if (!role || !roles.includes(role))
      return res.status(403).json({
        error: `Requires role: ${roles.join(' / ')}`,
        your_role: role || 'anonymous'
      });
    next();
  };
}

/** Entitlement snapshot used across library + billing routes. Staff roles are
 *  always entitled; readers need a LIVE subscription (end date in future). */
export async function entitlements(profile, admin) {
  const staff = ['admin', 'publisher'].includes(profile?.role);
  if (staff) return { staff, premium: true, subscription: null };
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id,plan_id,status,current_start,current_end')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .gt('current_end', new Date().toISOString())
    .maybeSingle();
  return { staff, premium: !!sub, subscription: sub || null };
}

/** Re-fetch an entitled book row server-side; NEVER trust client input here.
 *  Single source of truth for "can this user open this book" — covers
 *  free tier, an active subscription, a one-time book purchase, AND staff
 *  previewing an unpublished book. Look up by id (default) or by slug
 *  (`{ bySlug: true }`, what every route actually has on hand). */
export async function bookEntitlement(admin, userId, entitlementsObj, bookIdOrSlug, { bySlug = false } = {}) {
  const { data: book } = await admin.from('books')
    .select('id,slug,title,subtitle,author,cover_emoji,tier,published,price_paise')
    .eq(bySlug ? 'slug' : 'id', bookIdOrSlug).maybeSingle();
  if (!book) return { allowed: false, code: 404, book: null };
  if (!book.published && !entitlementsObj.staff)
    return { allowed: false, code: 404, book };
  if (entitlementsObj.staff || book.tier === 'free' || entitlementsObj.premium)
    return { allowed: true, code: 200, book };
  const { data: purchase } = await admin.from('book_purchases')
    .select('id').eq('book_id', book.id).eq('user_id', userId).maybeSingle();
  if (purchase) return { allowed: true, code: 200, book };
  return { allowed: false, code: 402, book };
}