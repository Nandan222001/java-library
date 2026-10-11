/* ============================================================
 * import-json-books.mjs — import the pre-converted books in
 * scripts/books/*.json (spreads extracted from the source PDFs)
 * through the same admin endpoints as seed-books.mjs.
 * Full-replace per slug, safe to re-run.
 *
 *   cd server
 *   node scripts/import-json-books.mjs \
 *        --api http://localhost:8080 \
 *        --secret $ADMIN_IMPORT_SECRET \
 *        [--no-publish] [--only new-world-order]
 * ============================================================ */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

const API = (arg('--api') || 'http://localhost:8080').replace(/\/+$/, '');
const SECRET = arg('--secret') || process.env.ADMIN_IMPORT_SECRET;
const PUBLISH = !argv.includes('--no-publish');
const ONLY = arg('--only');

if (!SECRET) {
  console.error('Missing secret: pass --secret <ADMIN_IMPORT_SECRET>');
  process.exit(1);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), 'books');
const files = readdirSync(dir).filter(f => f.endsWith('.json') && (!ONLY || f === `${ONLY}.json`));

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': SECRET },
    body: JSON.stringify(body)
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}

let ok = 0, fail = 0;
for (const f of files) {
  const { meta, parts, spreads } = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  try {
    const chapters = spreads.map((s, i) => ({
      num: i + 1,
      part_id: s.l_kicker || (parts[0] && parts[0].part_id) || 'main',
      title: s.l_head || `Section ${i + 1}`,
      idx: i
    }));
    const out = await post('/api/admin/import', {
      book: { ...meta, published: PUBLISH },
      parts: parts.map((p, ord) => ({ ...p, ord })),
      chapters,
      spreads: spreads.map((s, i) => ({ idx: i, ...s }))
    });
    console.log(`✅ ${meta.slug.padEnd(26)} ${String(out.counts.spreads).padStart(3)} spreads · ${out.tier} · ${out.published ? 'published' : 'draft'}`);
    ok++;
  } catch (err) {
    fail++;
    console.error(`❌ ${meta.slug}: ${err.message}`);
  }
}
console.log(`\nDone — ${ok} imported, ${fail} failed.`);
process.exit(fail ? 1 : 0);
