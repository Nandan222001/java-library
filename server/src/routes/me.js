import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { entitlements } from '../middleware/rbac.js';
import { admin } from '../lib/supabase.js';

const r = Router();

/* GET /api/me — everything the UI needs about the signed-in reader */
r.get('/me', requireAuth, async (req, res) => {
  const ent = await entitlements(req.profile, admin);
  const [{ data: stats }, { data: badgeRows }] = await Promise.all([
    admin.from('player_stats')
      .select('points,current_streak,longest_streak')
      .eq('user_id', req.user.id).maybeSingle(),
    admin.from('user_badges')
      .select('badge_id,awarded_at,badges(label,description,icon)')
      .eq('user_id', req.user.id).order('awarded_at', { ascending: false })
  ]);
  res.json({
    user:   { id: req.user.id, email: req.user.email },
    profile: {
      role:         req.profile.role,
      display_name: req.profile.display_name
    },
    subscription: ent.subscription,
    entitlements: { staff: ent.staff, premium: ent.premium },
    points: stats?.points ?? 0,
    current_streak: stats?.current_streak ?? 0,
    longest_streak: stats?.longest_streak ?? 0,
    badges: (badgeRows || []).map(b => ({
      id: b.badge_id, awarded_at: b.awarded_at, ...b.badges
    }))
  });
});

/* PATCH /api/me — rename yourself. Executed WITH THE USER'S TOKEN so Postgres
 * RLS (profiles_update policy) authorises the write — server never overreaches. */
r.patch('/me', requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.display_name ?? '').trim();
    if (name.length < 2 || name.length > 60)
      return res.status(400).json({ error: 'Display name must be 2–60 characters' });
    const { error } = await req.sb
      .from('profiles')
      .update({ display_name: name })
      .eq('id', req.user.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true, display_name: name });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default r;