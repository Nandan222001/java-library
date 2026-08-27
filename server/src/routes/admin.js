import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { admin } from '../lib/supabase.js';

const r = Router();

/** Admin gate: EITHER a verified JWT whose profile.role === 'admin',
 *  OR the ops automation header x-admin-secret matching ADMIN_IMPORT_SECRET. */
function adminGate(req, res, next) {
  const secret = process.env.ADMIN_IMPORT_SECRET;
  if (secret && req.get('x-admin-secret') === secret) return next();
  requireAuth(req, res, () => {
    if (req.profile?.role !== 'admin')
      return res.status(403).json({
        error: 'Admin only',
        hint: 'update profiles.role=… where id=… via SQL console'
      });
    next();
  });
}

const str = (v, min, max) =>
  typeof v === 'string' && v.length >= min && v.length <= max ? v : null;

/* ---------------------------------------------------------------
 * POST /api/admin/import
 * Body: { book:{slug,title,…}, parts[], chapters[], spreads[] }
 * Full-replace semantics per slug — safe to re-run any time.
 * --------------------------------------------------------------- */
r.post('/import', adminGate, async (req, res) => {
  const b = req.body || {};
  const meta = b.book || {};
  const parts = Array.isArray(b.parts) ? b.parts : [];
  const chapters = Array.isArray(b.chapters) ? b.chapters : [];
  const spreads = Array.isArray(b.spreads) ? b.spreads : [];

  const slug = str(meta.slug, 2, 80);
  const title = str(meta.title, 2, 200);
  if (!slug || !/^[a-z0-9-]+$/.test(slug))
    return res.status(400).json({ error: 'book.slug must be kebab-case [a-z0-9-]' });
  if (!title) return res.status(400).json({ error: 'book.title required' });
  if (!chapters.length) return res.status(400).json({ error: 'chapters[] empty' });
  if (!spreads.length) return res.status(400).json({ error: 'spreads[] empty' });
  if (spreads.length > 3000)
    return res.status(413).json({ error: 'Too many spreads (max 3000/run)' });

  const tier = meta.tier === 'premium' ? 'premium' : 'free';

  const { data: book, error: bookErr } = await admin
    .from('books')
    .upsert({
      slug,
      title,
      subtitle: String(meta.subtitle || ''),
      author: String(meta.author || ''),
      cover_emoji: str(meta.cover_emoji, 1, 8) || '📕',
      tier,
      published: !!meta.published
    }, { onConflict: 'slug' })
    .select('id,slug,title,tier,published')
    .single();
  if (bookErr) return res.status(500).json({ error: bookErr.message });
  const id = book.id;

  // full replace of dependents
  await Promise.all([
    admin.from('book_parts').delete().eq('book_id', id),
    admin.from('chapters').delete().eq('book_id', id),
    admin.from('spreads').delete().eq('book_id', id)
  ]);

  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  try {
    for (const c of chunk(parts.map(p => ({
      book_id: id, part_id: p.part_id, label: p.label,
      color: p.color || '#888888', ord: p.ord ?? 0
    })), 100))
      { const e = (await admin.from('book_parts').insert(c)).error;
        if (e) throw e; }

    for (const c of chunk(chapters.map(ch => ({
      book_id: id, num: ch.num, part_id: ch.part_id,
      title: ch.title, idx: ch.idx
    })), 200))
      { const e = (await admin.from('chapters').insert(c)).error;
        if (e) throw e; }

    for (const c of chunk(spreads.map(s => ({
      book_id: id, idx: s.idx,
      l_kicker: s.l_kicker || '', l_head: s.l_head || '', l_html: s.l_html || '',
      r_kicker: s.r_kicker || '', r_head: s.r_head || '', r_html: s.r_html || ''
    })), 50))
      { const e = (await admin.from('spreads').insert(c)).error;
        if (e) throw e; }
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      partial: true,
      note: 'Book row exists; re-run import to repair all rows.'
    });
  }

  console.log(`[IMPORT] "${title}" (${slug}) · ${parts.length} parts · ` +
              `${chapters.length} chapters · ${spreads.length} spreads`);
  res.status(201).json({ ok: true, book_id: id, slug,
    counts: { parts: parts.length, chapters: chapters.length,
              spreads: spreads.length },
    tier: book.tier, published: book.published });
});

/* PATCH /api/admin/books/:id — flip published / tier */
r.patch('/books/:id', async (req, res) => {
  const secretOk = process.env.ADMIN_IMPORT_SECRET &&
    req.get('x-admin-secret') === process.env.ADMIN_IMPORT_SECRET;
  if (!secretOk)
    return new Promise(() => requireAuth(req, res, () => {
      if (req.profile?.role !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
      apply();
    }));
  apply();

  function apply() {
    const patch = {};
    if ('published' in req.body)
      patch.published = !!req.body.published;
    if ('tier' in req.body) {
      if (!['free', 'premium'].includes(req.body.tier))
        return res.status(400).json({ error: 'tier must be free|premium' });
      patch.tier = req.body.tier;
    }
    if (!Object.keys(patch).length)
      return res.status(400).json({ error: 'Nothing to update' });
    admin.from('books').update(patch)
      .eq('id', req.params.id)
      .select('id,slug,tier,published').single()
      .then(({ data, error }) => error
        ? res.status(400).json({ error: error.message })
        : res.json(data));
  }
});

export default r;