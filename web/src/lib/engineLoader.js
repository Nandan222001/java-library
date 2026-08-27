import { api, currentJwt, SUPABASE_URL, SUPABASE_KEY } from './supabase.js';

/* Loads the proven vanilla flip-book engine (web/public/engine/*) and feeds it
 * through OUR Node API so every spread passes authz + the premium paywall.
 * The engine only needs two globals before injection:
 *   window.BOOK_DB  (never used here — BOOK_SRC replaces Supabase REST)
 *   window.BOOK_SRC { init(), requestSpread(i), search(q) }               */

function injectScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

export async function mountReader(container, { slug, startFlips = 0 }) {
  /* exact DOM skeleton book.js expects */
  container.classList.add('reader-shell');
  container.innerHTML = `
    <div id="loader" style="display:none"></div>
    <header id="toolbar">
      <div class="tb-brand"><span class="logo">☕</span><b>Java</b><i>·Zero→FAANG</i></div>
      <div class="tb-search">
        <input id="searchBox" type="text" placeholder="Search this book…  ( / )" autocomplete="off">
        <div id="searchResults" hidden></div>
      </div>
      <div class="tb-actions">
        <button id="btnToc">☰ <span class="lbl">Contents</span></button>
        <button id="btnBm">🔖<span id="bmCount" class="cnt"></span></button>
        <button id="btnSound">🔊</button>
        <button id="btnTheme">🌙</button>
        <button id="btnFs">⛶</button>
      </div>
    </header>
    <main id="stage"><div id="bookWrap">
      <div id="bookPan"><div id="book"></div></div>
      <div class="spine-overlay"></div>
      <button id="hsPrev" class="hotspot hs-left" aria-label="Previous page">‹</button>
      <button id="hsNext" class="hotspot hs-right" aria-label="Next page">›</button>
    </div></main>
    <footer id="bottombar">
      <button id="btnPrev" class="navbtn">‹ Prev</button>
      <div id="progressWrap">
        <input type="range" id="scrubber" min="0" max="1" step="1" value="0" aria-label="Jump to any spread">
        <span id="pageLabel"></span>
      </div>
      <button id="btnNext" class="navbtn">Next ›</button>
    </footer>
    <aside id="tocDrawer" aria-label="Table of contents">
      <div class="dr-head"><h3>📖 Contents</h3><button id="drClose">✕</button></div>
      <div id="tocList"></div>
      <div class="dr-bm"><h4>🔖 Bookmarked spreads</h4><div id="bmList"></div></div>
    </aside>
    <div id="toastZone" aria-live="polite"></div>`;

  const jwt = await currentJwt();
  window.__SB_AUTH_JWT = jwt;                    // read by patched REST bridge

  // ---- window.BOOK_SRC backed by our API ---------------------------------
  let meta = null;
  let S = 0;
  const cache = new Map();

  window.BOOK_SRC = {
    remote: true,
    init: async () => {
      meta = await api(`/api/books/${slug}/meta`);
      if (!meta.can_read) {
        const err = new Error('subscription_required');
        err.status = 402; throw err;
      }
      S = meta.chapters.length
        ? Math.max(...meta.chapters.map(c => c.idx)) + 1 : 0;
      const parts = {};
      meta.parts.forEach(p => {
        parts[p.part_id] = { id: p.part_id, label: p.label, color: p.color };
      });
      const BK = {
        parts,
        order: meta.parts.sort((a, b) => a.ord - b.ord).map(p => p.part_id),
        chapters: meta.chapters.map(c =>
          ({ partId: c.part_id, num: c.num, title: c.title, idx: c.idx })),
        spreads: Array.from({ length: S }, () => ({ left: null, right: null })),
        part() {}, chapter() {}, spread() {}
      };
      window.BOOK = BK;
      return BK;
    },
    requestSpread: async i => {
      if (cache.has(i)) return cache.get(i);
      const d = await api(`/api/books/${slug}/spreads/${i}`);
      const row = {
        l: { kicker: d.l_kicker, head: d.l_head, html: d.l_html },
        r: { kicker: d.r_kicker, head: d.r_head, html: d.r_html }
      };
      cache.set(i, row);
      return row;
    },
    search: async q => {
      const rows = await api(
        `/api/books/${slug}/search?q=${encodeURIComponent(q)}`);
      return rows.map(r2 => {
        const useR = (r2.rn || '').replace(/\s+/g, '').length >=
                     (r2.ln || '').replace(/\s+/g, '').length;
        return {
          flips: r2.idx + 1,
          num: useR ? r2.idx * 2 + 2 : r2.idx * 2 + 1,
          txt: useR ? r2.rn : r2.ln
        };
      });
    }
  };

  await injectScript('/engine/js/sound.js?v=6');
  await injectScript('/engine/js/highlight.js?v=6');
  await injectScript('/engine/js/book.js?v=6');     // builds leaves from window.BOOK

  window.__READER_FLUSH = async () => {              // progress sync hook
    try {
      const st = window.__book?.state?.();
      if (!st) return;
      await api(`/api/books/${slug}/progress`,
        { method: 'PUT', body: JSON.stringify({ flips: st.flipped }) });
    } catch {/* silent — progress is best-effort */}
  };
  if (startFlips > 0 && window.__book)
    window.__book.goToSpread(Math.max(0, startFlips - 1));

  return { meta, engine: window.__book };
}

export function unmountReader(container) {
  container.innerHTML = '';
  delete window.BOOK;
  delete window.__book;
  delete window.READER;
}