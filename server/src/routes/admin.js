import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { admin } from '../lib/supabase.js';
import { getSmtpSettings, sendMail } from '../lib/mailer.js';

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

/* PATCH /api/admin/books/:slug/spreads/:idx — edit one spread's content
 * in place, without a full-book reimport. Useful for content touch-ups
 * (a page that overflows its fixed height, a typo) that don't need the
 * full-replace semantics of POST /import. */
r.patch('/books/:slug/spreads/:idx', adminGate, async (req, res) => {
  const idx = Number(req.params.idx);
  if (!Number.isInteger(idx) || idx < 0)
    return res.status(400).json({ error: 'idx must be a non-negative integer' });
  const { data: book } = await admin.from('books')
    .select('id').eq('slug', req.params.slug).maybeSingle();
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const b = req.body || {};
  const patch = {};
  for (const field of ['l_kicker', 'l_head', 'l_html', 'r_kicker', 'r_head', 'r_html']) {
    if (field in b) patch[field] = String(b[field] ?? '');
  }
  if (!Object.keys(patch).length)
    return res.status(400).json({ error: 'Nothing to update' });

  const { data, error } = await admin.from('spreads').update(patch)
    .eq('book_id', book.id).eq('idx', idx)
    .select('idx,l_head,r_head').maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: `No spread at idx ${idx} for this book` });
  res.json({ ok: true, ...data });
});

/* GET /api/admin/books — every book regardless of published state, for
 * the admin panel's book list (the public GET /api/books only returns
 * published ones) */
r.get('/books', adminGate, async (req, res) => {
  const { data, error } = await admin.from('books')
    .select('id,slug,title,subtitle,author,cover_emoji,tier,published,price_paise,created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* PATCH /api/admin/books/:id — edit book metadata (title/tier/price/
 * cover/publish/...). Content (chapters/spreads) is intentionally out of
 * scope here — that stays the CLI import script's job. */
r.patch('/books/:id', adminGate, async (req, res) => {
  const b = req.body || {};
  const patch = {};
  if ('title' in b) {
    const v = str(b.title, 2, 200);
    if (!v) return res.status(400).json({ error: 'title must be 2-200 chars' });
    patch.title = v;
  }
  if ('subtitle' in b) patch.subtitle = String(b.subtitle ?? '').slice(0, 300);
  if ('author' in b) patch.author = String(b.author ?? '').slice(0, 120);
  if ('cover_emoji' in b) {
    const v = str(b.cover_emoji, 1, 8);
    if (!v) return res.status(400).json({ error: 'cover_emoji must be 1-8 chars' });
    patch.cover_emoji = v;
  }
  if ('tier' in b) {
    if (!['free', 'premium'].includes(b.tier))
      return res.status(400).json({ error: 'tier must be free|premium' });
    patch.tier = b.tier;
  }
  if ('price_paise' in b) {
    const v = Number(b.price_paise);
    if (!Number.isFinite(v) || v < 0)
      return res.status(400).json({ error: 'price_paise must be >= 0' });
    patch.price_paise = Math.round(v);
  }
  if ('published' in b) patch.published = !!b.published;
  if (!Object.keys(patch).length)
    return res.status(400).json({ error: 'Nothing to update' });
  const { data, error } = await admin.from('books').update(patch)
    .eq('id', req.params.id)
    .select('id,slug,title,subtitle,author,cover_emoji,tier,published,price_paise')
    .maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Book not found' });
  res.json(data);
});

/* DELETE /api/admin/books/:id — permanently remove a book and its content.
 * Every dependent table (book_parts/chapters/spreads/book_purchases/
 * practice_questions/practice_attempts/reading_progress/book_grants)
 * cascades from the `books` FK — deleting the book row is enough. The one
 * exception is `payments.book_id`, which has no cascade on purpose (it's a
 * financial ledger, never auto-pruned) — if any payment references this
 * book, Postgres rejects the delete and that FK error is surfaced as-is
 * rather than silently orphaning/deleting revenue records. */
r.delete('/books/:id', adminGate, async (req, res) => {
  const { data: book } = await admin.from('books')
    .select('id,slug,title').eq('id', req.params.id).maybeSingle();
  if (!book) return res.status(404).json({ error: 'Book not found' });
  const { error } = await admin.from('books').delete().eq('id', book.id);
  if (error) return res.status(409).json({
    error: error.message,
    hint: 'A payments record likely still references this book — it cannot be deleted.'
  });
  res.json({ ok: true, deleted: book.slug });
});

/* POST /api/admin/books/:slug/practice/import — full-replace a book's MCQ
 * practice bank, same full-replace-per-slug semantics as POST /import. */
r.post('/books/:slug/practice/import', adminGate, async (req, res) => {
  const { data: book } = await admin.from('books')
    .select('id,slug').eq('slug', req.params.slug).maybeSingle();
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
  if (!questions.length) return res.status(400).json({ error: 'questions[] empty' });
  for (const q of questions) {
    if (!str(q.question, 2, 2000))
      return res.status(400).json({ error: 'Each question needs 2-2000 char question text' });
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.some(o => typeof o !== 'string'))
      return res.status(400).json({ error: 'Each question needs options[] (>= 2 strings)' });
    if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index >= q.options.length)
      return res.status(400).json({ error: 'correct_index must index into options[]' });
  }

  const rows = questions.map(q => ({
    book_id: book.id,
    question: q.question,
    options: q.options,
    correct_index: q.correct_index,
    explanation: String(q.explanation || ''),
    difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium'
  }));

  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  try {
    await admin.from('practice_questions').delete().eq('book_id', book.id);
    for (const c of chunk(rows, 100)) {
      const { error } = await admin.from('practice_questions').insert(c);
      if (error) throw error;
    }
  } catch (err) {
    return res.status(500).json({
      error: err.message, partial: true,
      note: 'Some questions may not have been inserted; re-run to repair.'
    });
  }

  res.status(201).json({ ok: true, book_id: book.id, count: rows.length });
});

/* PATCH /api/admin/plans/:plan_id — edit a subscription plan */
r.patch('/plans/:plan_id', adminGate, async (req, res) => {
  const b = req.body || {};
  const patch = {};
  if ('name' in b) {
    const v = str(b.name, 1, 100);
    if (!v) return res.status(400).json({ error: 'name must be 1-100 chars' });
    patch.name = v;
  }
  if ('price_paise' in b) {
    const v = Number(b.price_paise);
    if (!Number.isFinite(v) || v < 0)
      return res.status(400).json({ error: 'price_paise must be >= 0' });
    patch.price_paise = Math.round(v);
  }
  if ('interval_days' in b) {
    const v = Number(b.interval_days);
    if (!Number.isFinite(v) || v < 0)
      return res.status(400).json({ error: 'interval_days must be >= 0' });
    patch.interval_days = Math.round(v);
  }
  if ('features' in b) {
    if (!Array.isArray(b.features) || !b.features.every(f => typeof f === 'string'))
      return res.status(400).json({ error: 'features must be an array of strings' });
    patch.features = b.features;
  }
  if (!Object.keys(patch).length)
    return res.status(400).json({ error: 'Nothing to update' });
  const { data, error } = await admin.from('plans').update(patch)
    .eq('plan_id', req.params.plan_id).select().maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Plan not found' });
  res.json(data);
});

/* GET /api/admin/users?q=&limit= — profiles + their current subscription */
r.get('/users', adminGate, async (req, res) => {
  const q = String(req.query.q || '').trim().replace(/[,()]/g, '');
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  let query = admin.from('profiles')
    .select('id,email,display_name,role,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (q) query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);
  const { data: users, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const ids = users.map(u => u.id);
  const { data: subs } = ids.length
    ? await admin.from('subscriptions')
        .select('user_id,plan_id,status,current_end')
        .in('user_id', ids).eq('status', 'active')
        .gt('current_end', new Date().toISOString())
    : { data: [] };
  const subMap = new Map((subs || []).map(s => [s.user_id, s]));

  /* read-permission grants per user (book_grants) so the admin panel can
   * show and revoke them inline */
  const { data: grants } = ids.length
    ? await admin.from('book_grants')
        .select('user_id,book_id,created_at,books(slug,title,cover_emoji)')
        .in('user_id', ids)
    : { data: [] };
  const grantMap = new Map();
  for (const g of grants || []) {
    if (!grantMap.has(g.user_id)) grantMap.set(g.user_id, []);
    grantMap.get(g.user_id).push({
      book_id: g.book_id,
      slug: g.books?.slug || '',
      title: g.books?.title || 'Book',
      cover_emoji: g.books?.cover_emoji || '📕',
      created_at: g.created_at
    });
  }

  res.json(users.map(u => ({
    ...u,
    subscription: subMap.get(u.id) || null,
    granted_books: grantMap.get(u.id) || []
  })));
});

/* PATCH /api/admin/users/:id — change role and/or grant/revoke premium.
 * Two independent, optional actions in one request:
 *   { role: 'reader'|'publisher'|'admin' }
 *   { grant_premium: { plan_id, days? } }   (days overrides the plan's own interval)
 *   { revoke_premium: true }                (immediate — unlike self-service
 *                                             cancel, access ends NOW, not at
 *                                             period end; for abuse handling) */
r.patch('/users/:id', adminGate, async (req, res) => {
  try {
    const targetId = req.params.id;
    const b = req.body || {};

    if ('role' in b) {
      if (!['reader', 'publisher', 'admin'].includes(b.role))
        return res.status(400).json({ error: 'role must be reader|publisher|admin' });
      if (b.role !== 'admin') {
        const { data: target } = await admin.from('profiles')
          .select('role').eq('id', targetId).maybeSingle();
        if (target?.role === 'admin') {
          const { count } = await admin.from('profiles')
            .select('id', { count: 'exact', head: true }).eq('role', 'admin');
          if ((count || 0) <= 1)
            return res.status(400).json({ error: 'Cannot demote the last remaining admin' });
        }
      }
      const { error } = await admin.from('profiles')
        .update({ role: b.role }).eq('id', targetId);
      if (error) return res.status(400).json({ error: error.message });
    }

    if (b.grant_premium) {
      const planId = b.grant_premium.plan_id || 'premium_monthly';
      const { data: plan } = await admin.from('plans')
        .select('*').eq('plan_id', planId).maybeSingle();
      if (!plan || plan.plan_id === 'free')
        return res.status(400).json({ error: 'Unknown paid plan_id' });
      const days = Number(b.grant_premium.days);
      const durationDays = Number.isFinite(days) && days > 0 ? days : plan.interval_days;
      const start = new Date();
      const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
      await admin.from('subscriptions')
        .update({ status: 'canceled', canceled_at: start.toISOString() })
        .eq('user_id', targetId).eq('status', 'active');
      const { error } = await admin.from('subscriptions').insert({
        user_id: targetId, plan_id: plan.plan_id, status: 'active',
        provider: 'sandbox',
        provider_ref: `admin_grant_${Date.now().toString(36)}_${req.user?.id?.slice(0, 8) || 'secret'}`,
        current_start: start.toISOString(), current_end: end.toISOString()
      });
      if (error) return res.status(400).json({ error: error.message });
    }

    if (b.revoke_premium) {
      const now = new Date().toISOString();
      const { error } = await admin.from('subscriptions')
        .update({ status: 'canceled', canceled_at: now, current_end: now })
        .eq('user_id', targetId).eq('status', 'active');
      if (error) return res.status(400).json({ error: error.message });
    }

    if (!('role' in b) && !b.grant_premium && !b.revoke_premium)
      return res.status(400).json({ error: 'Nothing to update' });

    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* ---------------------------------------------------------------
 * Analytics — powers the admin Dashboard (sales graphs, signups,
 * top books, recent transactions). Pure read-only aggregation over
 * the payments ledger + subscriptions + purchases + profiles.
 * --------------------------------------------------------------- */
r.get('/stats', adminGate, async (_req, res) => {
  try {
    const DAY = 86400000;
    const now = new Date();
    const since = new Date(now.getTime() - 13 * DAY);
    since.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayKey = d =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const [{ count: userCount }, { data: booksR, error: booksErr },
           { data: subsR }, { data: payR }, { data: signR },
           { data: purchR }, { data: allPayR }, { data: recentR }] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('books').select('id,title,slug,cover_emoji,published'),
      admin.from('subscriptions').select('plan_id')
        .eq('status', 'active').gt('current_end', now.toISOString()),
      admin.from('payments').select('amount_paise,kind,status,created_at')
        .gte('created_at', since.toISOString()),
      admin.from('profiles').select('created_at').gte('created_at', since.toISOString()),
      admin.from('book_purchases').select('book_id,price_paise_paid').limit(5000),
      admin.from('payments').select('amount_paise,kind,status,created_at')
        .in('status', ['captured']).limit(10000),
      admin.from('payments')
        .select('id,user_id,kind,amount_paise,provider,plan_id,book_id,status,created_at')
        .order('created_at', { ascending: false }).limit(10)
    ]);
    if (booksErr) throw booksErr;

    const txIds = (recentR || []).map(tx => tx.user_id);
    const profRows = txIds.length
      ? (await admin.from('profiles')
          .select('id,email,display_name').in('id', txIds)).data
      : [];
    const planRows = (await admin.from('plans').select('plan_id,name')).data || [];

    const bookMeta = new Map((booksR || []).map(b => [b.id, b]));
    const userMap = new Map(profRows.map(u => [u.id, u]));
    const planName = new Map(planRows.map(p => [p.plan_id, p.name]));

    const buckets = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.push({
        date: dayKey(d),
        label: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`,
        orders: 0, revenue_paise: 0, signups: 0
      });
    }
    const byKey = new Map(buckets.map(b => [b.date, b]));

    for (const p of payR || []) {
      const b = byKey.get(dayKey(new Date(p.created_at)));
      if (!b) continue;
      b.orders += 1;
      if (p.status === 'captured' && p.kind !== 'admin_grant') b.revenue_paise += p.amount_paise;
    }
    for (const s of signR || []) {
      const b = byKey.get(dayKey(new Date(s.created_at)));
      if (b) b.signups += 1;
    }

    let totalRevenue = 0, monthRevenue = 0;
    for (const p of allPayR || []) {
      if (p.status !== 'captured' || p.kind === 'admin_grant') continue;
      totalRevenue += p.amount_paise;
      if (new Date(p.created_at) >= monthStart) monthRevenue += p.amount_paise;
    }

    const bookAgg = new Map();
    for (const p of purchR || []) {
      const a = bookAgg.get(p.book_id) || { purchases: 0, revenue_paise: 0 };
      a.purchases += 1;
      a.revenue_paise += p.price_paise_paid || 0;
      bookAgg.set(p.book_id, a);
    }
    const top_books = [...bookAgg.entries()]
      .map(([id, a]) => ({ ...a, ...(bookMeta.get(id) || {}) }))
      .filter(b => b.title)
      .sort((a, b2) => b2.revenue_paise - a.revenue_paise)
      .slice(0, 6)
      .map(b => ({
        slug: b.slug, title: b.title,
        cover_emoji: b.cover_emoji || '📕',
        purchases: b.purchases, revenue_paise: b.revenue_paise
      }));

    const planCount = new Map();
    for (const s of subsR || []) planCount.set(s.plan_id, (planCount.get(s.plan_id) || 0) + 1);

    const recent_transactions = (recentR || []).map(tx => ({
      id: tx.id,
      user_name: userMap.get(tx.user_id)?.display_name || '',
      user_email: userMap.get(tx.user_id)?.email || '',
      item: tx.plan_id ? (planName.get(tx.plan_id) || tx.plan_id)
           : tx.book_id ? (bookMeta.get(tx.book_id)?.title || 'Book') : '—',
      kind: tx.kind, amount_paise: tx.amount_paise,
      provider: tx.provider, status: tx.status, date: tx.created_at
    }));

    res.json({
      totals: {
        users: userCount || 0,
        books: (booksR || []).length,
        published_books: (booksR || []).filter(b => b.published).length,
        active_subs: (subsR || []).length,
        total_revenue_paise: totalRevenue,
        month_revenue_paise: monthRevenue
      },
      sales_series: buckets.map(b => ({
        date: b.date, label: b.label, orders: b.orders, revenue_paise: b.revenue_paise
      })),
      signups_series: buckets.map(b => ({ date: b.date, label: b.label, signups: b.signups })),
      top_books,
      plan_split: [...planCount.entries()].map(([plan_id, count]) => ({ plan_id, count })),
      recent_transactions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------------------------------------------------------
 * Books — create a brand-new book shell from the admin panel.
 * --------------------------------------------------------------- */
function slugifyBook(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'book';
}

r.post('/books', adminGate, async (req, res) => {
  const b = req.body || {};
  const title = str(b.title, 2, 200);
  if (!title) return res.status(400).json({ error: 'title required' });

  let slug = str(b.slug || slugifyBook(title), 2, 80);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) slug = slugifyBook(title);

  const { data: existing } = await admin.from('books')
    .select('slug').eq('slug', slug).maybeSingle();
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const { data, error } = await admin.from('books').insert({
    slug, title,
    subtitle: String(b.subtitle || '').slice(0, 300),
    author: String(b.author || '').slice(0, 120),
    cover_emoji: str(b.cover_emoji, 1, 8) || '📕',
    tier: b.tier === 'premium' ? 'premium' : 'free',
    price_paise: Math.max(0, Math.round(Number(b.price_paise) || 0)),
    published: !!b.published,
    created_by: req.user?.id || null
  }).select('id,slug,title,tier,published,price_paise').single();
  if (error) return res.status(400).json({ error: error.message });

  console.log(`[ADMIN] ${req.user?.id} created book "${title}" (${slug})`);
  res.status(201).json(data);
});

/* ---------------------------------------------------------------
 * Read-permission grants — give a specific user read access to a
 * specific book without any subscription/purchase. book_grants is
 * honored by has_book_access() in Postgres AND bookEntitlement() in
 * the Node API, so the wall is closed at both layers.
 * --------------------------------------------------------------- */
r.get('/grants', adminGate, async (_req, res) => {
  const { data, error } = await admin.from('book_grants')
    .select('id,user_id,book_id,note,created_at,profiles(email,display_name),books(slug,title,cover_emoji)')
    .order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(g => ({
    id: g.id, user_id: g.user_id, book_id: g.book_id,
    note: g.note || '', created_at: g.created_at,
    user_email: g.profiles?.email || '',
    user_name: g.profiles?.display_name || '',
    book_slug: g.books?.slug || '',
    book_title: g.books?.title || '',
    cover_emoji: g.books?.cover_emoji || '📕'
  })));
});

r.post('/grants', adminGate, async (req, res) => {
  const { user_id, book_id } = req.body || {};
  if (typeof user_id !== 'string' || typeof book_id !== 'string')
    return res.status(400).json({ error: 'user_id and book_id required' });
  const { data, error } = await admin.from('book_grants').upsert({
    user_id, book_id,
    granted_by: req.user?.id || null,
    note: String(req.body?.note || '').slice(0, 200)
  }, { onConflict: 'user_id,book_id', ignoreDuplicates: true })
    .select('id,user_id,book_id')
    .maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data || { ok: true });
});

r.delete('/grants', adminGate, async (req, res) => {
  const { user_id, book_id } = req.body || req.query || {};
  if (!user_id || !book_id)
    return res.status(400).json({ error: 'user_id and book_id required' });
  const { error } = await admin.from('book_grants').delete()
    .eq('user_id', user_id).eq('book_id', book_id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

/* ---------------------------------------------------------------
 * SMTP settings — used by the server's own outgoing email (the
 * learning-reminder feature, admin test sends). Separate from, and
 * has no effect on, Supabase Auth's own confirmation/reset emails —
 * those are configured only in the Supabase Dashboard.
 * --------------------------------------------------------------- */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* GET /api/admin/smtp — never returns the password; `configured` tells
 * the admin UI whether a row exists yet at all. */
r.get('/smtp', adminGate, async (req, res) => {
  const { data, error } = await admin.from('smtp_settings')
    .select('host,port,secure,username,from_email,from_name,updated_at')
    .eq('id', 1).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ configured: !!data, ...data });
});

/* PUT /api/admin/smtp — upsert the singleton row. `password` is optional
 * on an update (blank keeps the existing one) but required the first
 * time a row is created. */
r.put('/smtp', adminGate, async (req, res) => {
  const b = req.body || {};
  const host = str(b.host, 1, 255);
  const port = Number(b.port);
  const username = str(b.username, 1, 255);
  const fromEmail = str(b.from_email, 3, 255);
  const fromName = String(b.from_name ?? '').slice(0, 120);
  const password = typeof b.password === 'string' ? b.password : '';

  if (!host) return res.status(400).json({ error: 'host required' });
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return res.status(400).json({ error: 'port must be 1-65535' });
  if (!username) return res.status(400).json({ error: 'username required' });
  if (!fromEmail || !EMAIL_RE.test(fromEmail))
    return res.status(400).json({ error: 'from_email must be a valid email address' });

  const { data: existing } = await admin.from('smtp_settings')
    .select('password').eq('id', 1).maybeSingle();
  if (!existing && !password)
    return res.status(400).json({ error: 'password required on first setup' });

  const { error } = await admin.from('smtp_settings').upsert({
    id: 1, host, port, secure: !!b.secure, username,
    password: password || existing.password,
    from_email: fromEmail, from_name: fromName,
    updated_at: new Date().toISOString(), updated_by: req.user?.id || null
  }, { onConflict: 'id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

/* POST /api/admin/smtp/test — sends a real email using the saved settings
 * so the admin can confirm Gmail app-password / port / TLS choices work
 * before relying on them for the reminder feature. Defaults `to` to the
 * requesting admin's own email. */
r.post('/smtp/test', adminGate, async (req, res) => {
  const to = str(req.body?.to, 3, 255) || req.profile?.email;
  if (!to || !EMAIL_RE.test(to))
    return res.status(400).json({ error: 'to must be a valid email address' });
  try {
    const settings = await getSmtpSettings();
    if (!settings)
      return res.status(400).json({ error: 'Save SMTP settings before sending a test email' });
    await sendMail({
      to, subject: '☕ Java Library — SMTP test email',
      html: '<p>This confirms your SMTP settings are working. 🎉</p>' +
            '<p>Sent from the Java Library admin panel.</p>',
      text: 'This confirms your SMTP settings are working. Sent from the Java Library admin panel.'
    });
    res.json({ ok: true, sent_to: to });
  } catch (err) {
    res.status(502).json({ error: `SMTP send failed: ${err.message}` });
  }
});

export default r;