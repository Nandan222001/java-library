/** Thin wrappers around the touch_streak()/award_points() SQL functions
 *  (both security definer, with EXECUTE revoked from anon/authenticated —
 *  see supabase/migrations/002_pricing_mcq_gamification.sql) plus
 *  hardcoded badge-rule evaluation. Always called with the `admin`
 *  service-role client from an already-audited Node code path — these
 *  are not meant to be reachable any other way. */

export async function awardPoints(admin, userId, kind, points, refId) {
  const { data, error } = await admin.rpc('award_points', {
    p_user: userId, p_kind: kind, p_points: points, p_ref_id: String(refId)
  });
  if (error) throw error;
  return data?.[0] || { awarded: false, total_points: 0 };
}

export async function touchStreak(admin, userId) {
  const { data, error } = await admin.rpc('touch_streak', { p_user: userId });
  if (error) throw error;
  return data?.[0] || { current_streak: 0, longest_streak: 0 };
}

/** Four fixed rules — not worth a generic criteria engine for this many.
 *  'quiz_ace' is awarded directly by the practice submit route the moment
 *  it sees a perfect round, since that's a one-shot event this function
 *  has no natural way to detect after the fact. */
export async function evaluateBadges(admin, userId) {
  const [{ data: stats }, { count: attemptCount }] = await Promise.all([
    admin.from('player_stats').select('points,current_streak').eq('user_id', userId).maybeSingle(),
    admin.from('practice_attempts').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  ]);
  const toAward = [];
  if ((attemptCount || 0) >= 1) toAward.push('first_quiz');
  if ((stats?.current_streak || 0) >= 7) toAward.push('streak_7');
  if ((stats?.points || 0) >= 100) toAward.push('point_climber');
  if (!toAward.length) return [];
  const { data, error } = await admin.from('user_badges')
    .upsert(toAward.map(badge_id => ({ user_id: userId, badge_id })),
            { onConflict: 'user_id,badge_id', ignoreDuplicates: true })
    .select('badge_id');
  if (error) throw error;
  return data || [];
}
