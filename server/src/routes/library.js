import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { entitlements, bookEntitlement } from '../middleware/rbac.js';
import { admin } from '../lib/supabase.js';

const r = Router();

function ent(obj) {
  return { staff: obj.staff, premium: obj.premium };
}

/* every route here is signed-in-only */
r.use(requireAuth);

/* book row by slug */
async function loadBook(slug) {
  const { data, error } = await admin.from('books')
    .select('id,slug,title,subtitle,author,cover_emoji,tier,published')
    .eq('slug', slug).single();
  if (error || !data) {
    const e = new Error('Book not found'); e.status = 404; throw e;
  }
  return data;
}

/* GET /api/books — catalog grid with lock badges + resume position */
r.get('/', async (req, res) => {
  const e = await entitlements(req.profile, admin);
  const [{ data: books, error }, { data: prog }, { data: purchases }] = await Promise.all([
    admin.from('books').select(
      'id,slug,title,subtitle,author,cover_emoji,tier,published,price_paise')
      .eq('published', true).order('created_at'),
    admin.from('reading_progress')
      .select('book_id,flips').eq('user_id', req.user.id),
    admin.from('book_purchases').select('book_id').eq('user_id', req.user.id)
  ]);
  if (error) return res.status(500).json({ error: error.message });
  const progMap = new Map((prog || []).map(p => [p.book_id, p.flips]));
  const purchasedSet = new Set((purchases || []).map(p => p.book_id));
  res.json(books.map(b => ({
    ...b,
    locked: b.tier === 'premium' && !ent(e).premium && !purchasedSet.has(b.id),
    purchased: purchasedSet.has(b.id),
    continue_flips: progMap.get(b.id) ?? null,
    pages: null                                  // filled lazily on open
  })));
});

/* GET /api/books/:slug/meta — everything the reader shell needs pre-open */
r.get('/:slug/meta', async (req, res) => {
  try {
    const e = await entitlements(req.profile, admin);
    const { allowed, code, book } = await bookEntitlement(
      admin, req.user.id, e, req.params.slug, { bySlug: true });
    if (!book) return res.status(404).json({ error: 'Not found' });
    if (code === 404) return res.status(404).json({ error: 'Not found' });
    const [{ data: parts }, { data: chapters }, { data: prog }] = await Promise.all([
      admin.from('book_parts').select('part_id,label,color,ord')
           .eq('book_id', book.id).order('ord'),
      admin.from('chapters').select('num,part_id,title,idx')
           .eq('book_id', book.id).order('num'),
      admin.from('reading_progress').select('flips')
           .eq('user_id', req.user.id).eq('book_id', book.id).maybeSingle()
    ]);
    res.json({
      book: { slug: book.slug, title: book.title, subtitle: book.subtitle,
              author: book.author, cover_emoji: book.cover_emoji,
              tier: book.tier, price_paise: book.price_paise },
      parts, chapters,
      can_read: allowed,
      locked: !allowed,
      continue_flips: prog?.flips ?? 0
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* GET /api/books/:slug/spreads/:idx — ONE spread; server-side paywall */
r.get('/:slug/spreads/:idx(\\d+)', async (req, res) => {
  try {
    const idx = parseInt(req.params.idx, 10);
    const e = await entitlements(req.profile, admin);
    const { allowed, code, book } = await bookEntitlement(
      admin, req.user.id, e, req.params.slug, { bySlug: true });
    if (!book || code === 404) return res.status(404).json({ error: 'Not found' });
    if (!allowed) return res.status(402).json({
      error: 'subscription_required',
      message: 'This book needs an active Premium subscription (or purchase).'
    });
    const { data, error } = await admin.from('spreads')
      .select('idx,l_kicker,l_head,l_html,r_kicker,r_head,r_html')
      .eq('book_id', book.id).eq('idx', idx).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Spread not found' });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* GET /api/books/:slug/search?q=… — Postgres FTS RPC behind the same wall */
r.get('/:slug/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const e = await entitlements(req.profile, admin);
    const { allowed, code, book } = await bookEntitlement(
      admin, req.user.id, e, req.params.slug, { bySlug: true });
    if (!book || code === 404) return res.status(404).json({ error: 'Not found' });
    if (!allowed) return res.status(402).json({ error: 'subscription_required' });
    const { data, error } = await admin.rpc('search_spread_content',
      { p_book: book.id, q, lim: 22 });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);                              // [{idx, ln, rn}]
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* PUT /api/books/:slug/progress {flips} — RLS-checked upsert via USER client */
r.put('/:slug/progress', async (req, res) => {
  try {
    const book = await loadBook(req.params.slug);
    let flips = Number(req.body?.flips);
    if (!Number.isFinite(flips)) flips = 0;
    flips = Math.max(0, Math.min(Math.round(flips), 100000));
    const { error } = await req.sb.from('reading_progress')
      .upsert({ user_id: req.user.id, book_id: book.id, flips,
                updated_at: new Date().toISOString() },
              { onConflict: 'user_id,book_id' });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true, flips });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default r;