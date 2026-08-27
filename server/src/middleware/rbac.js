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

/** Re-fetch an entitled book row server-side; NEVER trust client input here. */
export async function bookEntitlement(admin, entitlementsObj, bookId) {
  const { data: book } = await admin.from('books')
    .select('id,slug,title,tier,published')
    .eq('id', bookId).single();
  if (!book || !book.published) return { allowed: false, code: 404 };
  const allowed =
    book.tier === 'free' || entitlementsObj.premium;
  return { allowed, code: allowed ? 200 : 402, book };
}