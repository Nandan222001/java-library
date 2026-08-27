import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { entitlements, bookEntitlement } from '../middleware/rbac.js';
import { admin } from '../lib/supabase.js';
import { awardPoints, touchStreak, evaluateBadges } from '../lib/gamification.js';

const r = Router();
r.use(requireAuth);

const POINTS_PER_CORRECT = 10;
const PERFECT_ROUND_BONUS = 25;

/* GET /api/books/:slug/practice?count=10 — a shuffled batch of practice
 * questions for the book, answer key stripped. Defense in depth: the DB
 * itself already refuses to grant correct_index/explanation to the
 * `authenticated` role (column-level GRANT, see the migration), so this
 * would still be safe even if the select() below were widened by mistake. */
r.get('/:slug/practice', async (req, res) => {
  try {
    const e = await entitlements(req.profile, admin);
    const { allowed, code, book } = await bookEntitlement(
      admin, req.user.id, e, req.params.slug, { bySlug: true });
    if (!book || code === 404) return res.status(404).json({ error: 'Not found' });
    if (!allowed) return res.status(402).json({ error: 'subscription_required' });

    const count = Math.min(Math.max(parseInt(req.query.count, 10) || 10, 1), 50);
    const { data, error } = await admin.from('practice_questions')
      .select('id,question,options,difficulty')
      .eq('book_id', book.id);
    if (error) return res.status(500).json({ error: error.message });
    if (!data.length) return res.json([]);

    // Fisher-Yates + slice — banks here are small (dozens/low hundreds
    // of questions), not worth an order-by-random() SQL round trip.
    const pool = [...data];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    res.json(pool.slice(0, count));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* POST /api/books/:slug/practice/submit {answers:[{question_id,selected_index}]}
 * Re-fetches the REAL rows via the service-role client to grade — never
 * trusts a client-submitted "correct" flag.
 *
 * Points use ref_id = question_id (NOT the new practice_attempts row's
 * own id): a practice_attempts row is inserted on every submission, so
 * keying off ITS id would mean the same question could be resubmitted
 * forever, each time minting a fresh (and therefore never-deduped)
 * ref_id — silently defeating award_points()'s whole dedup mechanism and
 * letting a user farm points by resubmitting the same question. Keying
 * off question_id means a given question only ever pays out once per
 * user, no matter how many times it's re-answered; the attempt history
 * itself is still recorded every time for analytics. */
r.post('/:slug/practice/submit', async (req, res) => {
  try {
    const e = await entitlements(req.profile, admin);
    const { allowed, code, book } = await bookEntitlement(
      admin, req.user.id, e, req.params.slug, { bySlug: true });
    if (!book || code === 404) return res.status(404).json({ error: 'Not found' });
    if (!allowed) return res.status(402).json({ error: 'subscription_required' });

    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!answers.length) return res.status(400).json({ error: 'answers[] empty' });
    const ids = [...new Set(answers.map(a => a?.question_id).filter(Boolean))];
    if (!ids.length) return res.status(400).json({ error: 'answers[].question_id required' });

    const { data: questions, error } = await admin.from('practice_questions')
      .select('id,book_id,correct_index,explanation')
      .in('id', ids);
    if (error) return res.status(500).json({ error: error.message });
    const qMap = new Map(questions.filter(q => q.book_id === book.id).map(q => [q.id, q]));

    const results = [];
    const attemptRows = [];
    let correctCount = 0;
    for (const a of answers) {
      const q = qMap.get(a.question_id);
      if (!q) continue;                              // ignore foreign/unknown ids
      const selected = Number.isInteger(a.selected_index) ? a.selected_index : -1;
      const correct = selected === q.correct_index;
      if (correct) correctCount++;
      results.push({ question_id: q.id, correct, correct_index: q.correct_index, explanation: q.explanation });
      attemptRows.push({
        user_id: req.user.id, question_id: q.id, book_id: book.id,
        selected_index: selected, correct
      });
    }
    if (!results.length) return res.status(400).json({ error: 'No valid questions in answers[]' });

    const { error: attemptErr } = await admin.from('practice_attempts').insert(attemptRows);
    if (attemptErr) return res.status(500).json({ error: attemptErr.message });

    let pointsAwarded = 0;
    for (const result of results) {
      if (!result.correct) continue;
      const { awarded } = await awardPoints(
        admin, req.user.id, 'quiz_correct', POINTS_PER_CORRECT, result.question_id);
      if (awarded) pointsAwarded += POINTS_PER_CORRECT;
    }

    const perfect = results.length > 0 && correctCount === results.length;
    let earnedAce = false;
    if (perfect) {
      const { awarded } = await awardPoints(
        admin, req.user.id, 'quiz_perfect', PERFECT_ROUND_BONUS, book.id);
      if (awarded) {
        pointsAwarded += PERFECT_ROUND_BONUS;
        const { error: badgeErr } = await admin.from('user_badges')
          .upsert({ user_id: req.user.id, badge_id: 'quiz_ace' },
                  { onConflict: 'user_id,badge_id', ignoreDuplicates: true });
        if (!badgeErr) earnedAce = true;
      }
    }

    await touchStreak(admin, req.user.id);
    const newBadges = await evaluateBadges(admin, req.user.id);

    res.json({
      score: correctCount,
      total: results.length,
      perfect,
      results,
      points_awarded: pointsAwarded,
      badges_awarded: [...(earnedAce ? ['quiz_ace'] : []), ...newBadges.map(b => b.badge_id)]
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default r;
