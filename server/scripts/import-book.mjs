/* ============================================================
 * import-book.mjs — bulk-import the original 400-question book
 * ("Java · Zero → FAANG") into the library database.
 *
 *   cd server
 *   node scripts/import-book.mjs \
 *        --content ../../java-book \
 *        --api http://localhost:8080 \
 *        --secret $ADMIN_IMPORT_SECRET \
 *        [--slug java-zero-to-faang] [--tier premium] [--publish]
 *
 * Reads the legacy project's boot.js manifest, assembles the whole
 * BOOK object (450 spreads / 73 chapters) and POSTs it to
 * POST /api/admin/import (full-replace semantics per slug).
 * ============================================================ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

const CONTENT = resolve(arg('--content') || '../../java-book');
const API     = (arg('--api') || 'http://localhost:8080').replace(/\/+$/, '');
const SECRET  = arg('--secret') || process.env.ADMIN_IMPORT_SECRET;
const SLUG    = arg('--slug') || 'java-zero-to-faang';
const TIER    = arg('--tier') === 'free' ? 'free' : 'premium';
const PUBLISH = !argv.includes('--no-publish');

if (!SECRET) {
  console.error('Missing secret: pass --secret <ADMIN_IMPORT_SECRET>');
  process.exit(1);
}

/* ---- assemble window.BOOK from the legacy bundle ---- */
global.window = {};
const bootSrc = readFileSync(join(CONTENT, 'js/boot.js'), 'utf8');
const seen = new Set();
const files = [...bootSrc.matchAll(/js\/content\/([\w.-]+\.js)/g)]
  .map(m => m[1]).filter(f => (seen.has(f) ? false : seen.add(f)));

if (files.length < 20)
  throw new Error(`Only found ${files.length} content files under ${CONTENT}`);

for (const f of files)
  eval(readFileSync(join(CONTENT, 'js/content', f), 'utf8'));
const B = global.window.BOOK;

console.log(`Loaded "${CONTENT}"`);
console.log(`  parts ${B.order.length} · chapters ${B.chapters.length} · spreads ${B.spreads.length}`);

/* ---- payload for POST /api/admin/import ---- */
const body = {
  book: {
    slug: SLUG,
    title: 'Java · Zero → FAANG',
    subtitle: 'The complete interview book — core Java to system design',
    author: '',
    cover_emoji: '☕',
    tier: TIER,
    published: PUBLISH
  },
  parts: B.order.map((part_id, ord) => ({
    part_id, ord, label: B.parts[part_id].label, color: B.parts[part_id].color
  })),
  chapters: B.chapters.map(c => ({
    num: c.num, part_id: c.partId, title: c.title, idx: c.idx
  })),
  spreads: B.spreads.map((s, idx) => ({
    idx,
    l_kicker: s.left.kicker || '', l_head: s.left.head || '', l_html: s.left.html || '',
    r_kicker: s.right.kicker || '', r_head: s.right.head || '', r_html: s.right.html || ''
  }))
};

console.log(`Posting ${(JSON.stringify(body).length / 1e6).toFixed(2)} MB → ${API}/api/admin/import …`);

const res = await fetch(`${API}/api/admin/import`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-secret': SECRET },
  body: JSON.stringify(body)
});
const txt = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}:`, txt.slice(0, 400));
  process.exit(1);
}
const out = JSON.parse(txt);
console.log('✅ imported:', JSON.stringify(out.counts),
            '| tier:', out.tier, '| published:', out.published);
console.log('\nNEXT: create an account, make yourself admin if needed:');
console.log("  update public.profiles set role='admin' where email='<you>';");