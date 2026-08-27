import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { admin } from '../lib/supabase.js';

const r = Router();
r.use(requireAuth);

/* GET /api/gamification/leaderboard?limit=20 — top readers by points.
 * player_stats' RLS is owner-read-only (see the migration), but this
 * route reads it through the `admin` service-role client, which bypasses
 * RLS entirely — that's intentional and is how every cross-user read in
 * this app works (same pattern as the admin routes). Only display_name/
 * points/streak are returned — no email or other PII. */
r.get('/leaderboard', async (_req, res) => {
  const limit = 20;
  const { data: stats, error } = await admin.from('player_stats')
    .select('user_id,points,current_streak')
    .order('points', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  if (!stats.length) return res.json([]);

  const { data: profiles } = await admin.from('profiles')
    .select('id,display_name').in('id', stats.map(s => s.user_id));
  const nameMap = new Map((profiles || []).map(p => [p.id, p.display_name]));

  res.json(stats.map((s, i) => ({
    rank: i + 1,
    display_name: nameMap.get(s.user_id) || 'Reader',
    points: s.points,
    current_streak: s.current_streak
  })));
});

export default r;
