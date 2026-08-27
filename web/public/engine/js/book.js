/* ================= Book engine — sheets, flips, navigation ================= */
(function () {
'use strict';
var $ = function (s) { return document.querySelector(s); };
var BOOK = window.BOOK, HL = window.HL, Snd = window.BookSound;
var bookEl = $('#book'), wrapEl = $('#bookWrap'), panEl = $('#bookPan');
var SRC = window.BOOK_SRC || null;
var REMOTE = !!(SRC && SRC.remote);   /* true → spread HTML streams from Supabase */

/* ---------------- cover & back cover ----------------
 * These used to be hardcoded to the original Java book's own title/emoji/
 * blurb -- harmless while it was the only book on the platform, but every
 * OTHER book's reader would show "JAVA ZERO → FAANG" on its own cover
 * once a second book existed. Built from window.BOOK's own metadata
 * instead (set by engineLoader.js from the book's real title/subtitle/
 * cover_emoji), with HL.escape() since book titles/subtitles are
 * admin-authored content, not baked-in trusted strings. */
var BOOK_TITLE = BOOK.title || 'Untitled Book';
var BOOK_SUBTITLE = BOOK.subtitle || '';
var BOOK_EMOJI = BOOK.cover_emoji || '📖';
var titleParts = BOOK_TITLE.split(' · ');
var coverTitleHtml = HL.escape(titleParts[0]) +
  (titleParts.length > 1 ? '<em>' + HL.escape(titleParts.slice(1).join(' · ')) + '</em>' : '');

var COVER = { raw: true, cls: 'cover', html:
  '<div class="cov-edition">FIRST EDITION</div>' +
  '<div class="cov-emoji" aria-hidden="true">' + BOOK_EMOJI + '</div>' +
  '<h1 class="cov-title">' + coverTitleHtml + '</h1>' +
  '<p class="cov-sub">' + HL.escape(BOOK_SUBTITLE) + '</p>' +
  '<div class="cov-line"></div>' +
  '<p class="cov-sub" style="font-size:13px;letter-spacing:.34em;font-style:normal;color:#b08d4a;margin-top:0">THEORY LEFT &nbsp;·&nbsp; VISUALS RIGHT</p>' };

var BACKCOV = { raw: true, cls: 'backcov', html:
  '<div class="cov-emoji" style="font-size:56px" aria-hidden="true">' + BOOK_EMOJI + '</div>' +
  '<p class="bc-blurb" style="margin-top:18px"><b>' + HL.escape(BOOK_TITLE) + '.</b> ' +
    HL.escape(BOOK_SUBTITLE) + ' Theory on the left, visuals on the right, zero fluff.</p>' +
  '<div class="bc-barcode"></div><div class="bc-price">HAPPY LEARNING · SHARE WIDELY</div>' };

/* ---------------- table of contents ---------------- */
(function buildToc() {
  var sides = [[], []];
  BOOK.chapters.forEach(function (c) {
    sides[(c.partId === 'p1' || c.partId === 'p2' || c.partId === 'p3') ? 0 : 1].push(c);
  });
  function rows(list) {
    return list.map(function (c) {
      return '<div class="toc-row" data-go="' + c.idx + '"><span class="toc-num">' +
        String(c.num).padStart(2, '0') + '</span><span class="toc-t">' + c.title +
        '</span><span class="toc-dots"></span><span class="toc-pg">' + (2 * c.idx + 1) + '</span></div>';
    }).join('');
  }
  function blocks(side) {
    return BOOK.order
      .filter(function (pid) { return sides[side].some(function (c) { return c.partId === pid; }); })
      .map(function (pid) {
        var P = BOOK.parts[pid];
        return '<div class="toc-part-h" style="--tc:' + P.color + '"><i></i>' + P.label + '</div>' +
          rows(sides[side].filter(function (c) { return c.partId === pid; }));
      }).join('');
  }
  BOOK.spreads[1].left.html =
    '<ul class="tree" style="margin-bottom:10px"><li class="rt">☕ About this book <span class="dts">· p.1</span></li>' +
    '<li class="rt">📑 Contents <span class="dts">· p.3</span></li></ul>' + blocks(0) +
    '<div class="toc-note">📖 Click any chapter to jump straight to it. Page numbers are printed on the outer corners.</div>';
  BOOK.spreads[1].right.html = blocks(1) +
    '<div class="toc-note">🔖 Press <strong>☆ Mark</strong> while reading to bookmark a spread — bookmarks appear in the ☰ Contents drawer for lightning-fast revision.</div>';
})();

/* ---------------- flatten spreads → pages ---------------- */
var pages = [COVER];
BOOK.spreads.forEach(function (sp) {
  pages.push({ kicker: sp.left.kicker || '', head: sp.left.head || '', html: sp.left.html });
  pages.push({ kicker: sp.right.kicker || '', head: sp.right.head || '', html: sp.right.html });
});
pages.push(BACKCOV);
for (var i = 1; i < pages.length - 1; i++) pages[i].num = i;

var N = Math.floor(pages.length / 2);   /* number of physical sheets */
var leaves = [];

function faceHTML(p, side) {
  if (p.raw) return '<div class="page ' + p.cls + '">' + p.html + '</div><i class="fold"></i>';
  var brand = '<span>☕ JAVA · ZERO→FAANG</span>';
  var num = '<span class="num">' + (p.num != null ? 'p. ' + p.num : '') + '</span>';
  var head = '<div class="pg-head"><span>' + (p.kicker || '') + '</span><span class="hd-r">' + (p.head || '') + '</span></div>';
  var foot = '<div class="pg-foot' + (side === 'front' ? ' pg-r-foot' : '') + '">' +
    (side === 'front' ? brand + num : num + brand) + '</div>';
  return '<div class="page">' + head + '<div class="pg-body">' + p.html + '</div>' + foot + '</div><i class="fold"></i>';
}

/* Lazy hydration: with hundreds of sheets, building + syntax-highlighting every
   page upfront is what makes load slow and flips janky. We create lightweight
   leaf/face shells for all sheets (needed for correct z-index stacking) but only
   fill in real HTML + highlighting for sheets near where the reader actually is. */
var hydrated = [];
function paintLeaf(i) {
  var leaf = leaves[i], fr = leaf.firstChild, bk = leaf.lastChild;
  fr.innerHTML = faceHTML(pages[2 * i], 'front');
  bk.innerHTML = faceHTML(pages[2 * i + 1], 'back');
  HL.decorate(fr); HL.decorate(bk);
}
function hydrateLeaf(i) {
  if (i < 0 || i >= N || hydrated[i]) return;
  /* Per-face hydration. A leaf's two faces belong to DIFFERENT spreads:
       front/right page  = spread (i-1).right  (leaf0's front is the static cover)
       back/left  page   = spread  i   .left
     Old code fetched a whole single spread for the leaf and skipped it whenever
     ANY face had html — so spread 0 (pages 1-2) was never fetched because it
     shares its leaves with the cover and the locally-rendered TOC, leaving
     pages 1-2 permanently blank in remote mode. We now fetch only the blank
     face(s) from the correct spread, so TOC/cover are never overwritten. */
  var fr = pages[2 * i], bk = pages[2 * i + 1];
  var needFr = !!fr && !fr.raw && !fr.html;   /* front page empty → spread (i-1).right */
  var needBk = !!bk && !bk.raw && !bk.html;   /* back  page empty → spread  i   .left   */
  if (!needFr && !needBk) { hydrated[i] = true; paintLeaf(i); return; }

  hydrated[i] = 'pending';                    /* de-dupe until data lands */
  var wants = [];
  if (needFr) wants.push(i - 1);
  if (needBk) wants.push(i);
  Promise.all(wants.map(function (k) { return SRC.requestSpread(k); }))
    .then(function (list) {
      if (needFr) {
        var a = list.shift();
        if (a) { fr.kicker = a.r.kicker || ''; fr.head = a.r.head || ''; fr.html = a.r.html; }
      }
      if (needBk) {
        var b = list.shift();
        if (b) { bk.kicker = b.l.kicker || ''; bk.head = b.l.head || ''; bk.html = b.l.html; }
      }
      if ((fr && fr.html) || (bk && bk.html)) { hydrated[i] = true; paintLeaf(i); }
      else hydrated[i] = false;               /* still empty → retry on next pass */
    })
    .catch(function () { hydrated[i] = false; });
}
var HYDRATE_RADIUS = 4;
function ensureHydrated(center, radius) {
  var r = radius == null ? HYDRATE_RADIUS : radius;
  for (var k = center - r; k <= center + r; k++) hydrateLeaf(k);
}
/* remote mode: neighbouring fetches already cover prefetching; walking the whole
   book in idle time would defeat the on-demand payload we're optimising for */
function idleHydrateRest() {
  if (REMOTE) return;
  var i = 0;
  function schedule(cb) {
    if (window.requestIdleCallback) requestIdleCallback(cb, { timeout: 1200 });
    else setTimeout(function () { cb({ timeRemaining: function () { return 8; } }); }, 200);
  }
  function step(deadline) {
    while (i < N && (!deadline || deadline.timeRemaining() > 4)) { hydrateLeaf(i); i++; }
    if (i < N) schedule(step);
  }
  schedule(step);
}

/* At any moment only the top 2 sheets of the stack (leaf f-1's back, leaf f's
   front) are ever actually visible — everything else is fully buried under
   nearer sheets. But every .leaf still carries backface-visibility/preserve-3d,
   which forces the browser to promote each one to its own GPU compositing
   layer — with hundreds of sheets that overwhelms the compositor and pages
   silently fail to paint. Sheets far from the current position are display:none
   (fully out of the render tree, zero compositing cost) so only a small window
   around the reader's position is ever actually rendered. */
var VISIBLE_RADIUS = 6;
var visWindowCenter = null;
function updateLeafVisibility(center) {
  if (visWindowCenter === center) return;
  visWindowCenter = center;
  for (var i = 0; i < N; i++) {
    leaves[i].style.display = Math.abs(i - center) <= VISIBLE_RADIUS ? '' : 'none';
  }
}

for (var j = 0; j < N; j++) {
  var leaf = document.createElement('div');
  leaf.className = 'leaf'; leaf.dataset.i = j;
  var fr = document.createElement('div'); fr.className = 'face front';
  var bk = document.createElement('div'); bk.className = 'face back';
  leaf.appendChild(fr); leaf.appendChild(bk);
  leaf.addEventListener('transitionend', function (e) {
    if (e.propertyName === 'transform') applyZ();
  });
  bookEl.appendChild(leaf);
  leaves.push(leaf);
}
updateLeafVisibility(0);
ensureHydrated(0, 8);
idleHydrateRest();

/* ---------------- flip state machine ---------------- */
var f = 0;   /* number of flipped sheets */
var mFront = true;   /* mobile single-page mode: true = right/front page of spread f, false = left/back page */

function applyZ() {
  for (var i = 0; i < N; i++) leaves[i].style.zIndex = String((i < f ? i + 5 : N - i) + 5);
}
applyZ();

function flipForward() {
  if (f >= N) { Snd.thump(); return; }
  ensureHydrated(f, HYDRATE_RADIUS);
  var l = leaves[f];
  l.classList.remove('noanim');
  l.style.zIndex = String(2 * N + 40);
  l.classList.add('flipped');
  f++;
  Snd.flip();
  if (f === N) setTimeout(function () { Snd.thump(); }, 700);
  setTimeout(applyZ, 720);   /* safety net in case transitionend is missed under load */
  syncUI();
}
function flipBackward() {
  if (f <= 0) { Snd.thump(); return; }
  f--;
  ensureHydrated(f, HYDRATE_RADIUS);
  var l = leaves[f];
  l.classList.remove('noanim');
  l.style.zIndex = String(2 * N + 40);
  l.classList.remove('flipped');
  Snd.flip();
  setTimeout(applyZ, 720);
  syncUI();
}
function goTo(target, instant) {
  target = Math.max(0, Math.min(N, target));
  if (target === f) return;
  ensureHydrated(target, HYDRATE_RADIUS);
  if (instant || Math.abs(target - f) > 1) {
    leaves.forEach(function (l, i) {
      l.classList.add('noanim');
      l.classList.toggle('flipped', i < target);
    });
    void bookEl.offsetWidth;
    requestAnimationFrame(function () {
      leaves.forEach(function (l) { l.classList.remove('noanim'); });
    });
    f = target; applyZ(); Snd.flip(); syncUI();
  } else {
    if (target > f) flipForward(); else flipBackward();
  }
  mFront = true; applyPan(true);
}

/* ---------------- mobile single-page navigation ---------------- */
var isMobile = false, curS = 1;
function checkMobile() {
  var was = isMobile;
  isMobile = window.matchMedia('(max-width:900px)').matches;
  if (isMobile && !was) mFront = true;   /* entering mobile mode: land on the front/right page */
}
function applyPan(instant) {
  if (!isMobile) { panEl.style.transition = ''; panEl.style.transform = ''; return; }
  var q = (1210 * curS) / 4;   /* derived from the scale we set, not re-measured — avoids stale layout reads */
  var t = 'translateX(' + (mFront ? -q : q) + 'px)';
  if (instant) {
    panEl.style.transition = 'none';
    panEl.style.transform = t;
    void panEl.offsetWidth;   /* flush so the transition:none takes effect before we restore it */
    panEl.style.transition = '';
  } else {
    panEl.style.transform = t;
  }
}
function mobileNext() {
  if (mFront) {
    if (f >= N) { Snd.thump(); return; }
    mFront = false; applyPan(true);   /* snap to the target page's slot instantly, then let the flip animate into it */
    flipForward();
  } else {
    if (f >= N) { Snd.thump(); return; }
    mFront = true; Snd.tick(); applyPan();
  }
  syncUI();
}
function mobilePrev() {
  if (mFront) {
    if (f < 1) { Snd.thump(); return; }
    mFront = false; Snd.tick(); applyPan();
  } else {
    mFront = true; applyPan(true);
    flipBackward();
  }
  syncUI();
}
function goNext() { if (isMobile) mobileNext(); else flipForward(); }
function goPrev() { if (isMobile) mobilePrev(); else flipBackward(); }

/* ---------------- UI refs & sync ---------------- */
var scrub = $('#scrubber'), pageLabel = $('#pageLabel'), btnPrev = $('#btnPrev'), btnNext = $('#btnNext'),
    btnMark = $('#btnMark'), bmCount = $('#bmCount'), drawer = $('#tocDrawer'), searchBox = $('#searchBox'),
    searchRes = $('#searchResults');
var bms = new Set();
try { JSON.parse(localStorage.getItem('jb_bm') || '[]').forEach(function (x) { bms.add(x); }); } catch (e) {}

function pad2(n) { return String(n).padStart(2, '0'); }

function syncUI() {
  updateLeafVisibility(f);
  scrub.max = N; scrub.value = f;
  scrub.style.setProperty('--fill', (f / N * 100) + '%');
  pageLabel.textContent = f === 0 ? 'Cover' : (f === N ? 'Back cover'
    : (isMobile ? 'p. ' + (mFront ? 2 * f : 2 * f - 1)
                : 'Pages ' + (2 * f - 1) + '–' + (2 * f)));
  btnPrev.disabled = (f === 0); btnNext.disabled = (f === N);
  var p = f - 1, on = p >= 0 && p < BOOK.spreads.length && bms.has(p);
  btnMark.classList.toggle('on', on);
  btnMark.textContent = on ? '★ Marked' : '☆ Mark';
  localStorage.setItem('jb_pos', String(f));
}

/* ---------------- bookmarks ---------------- */
function saveBms() {
  localStorage.setItem('jb_bm', JSON.stringify(Array.from(bms).sort(function (a, b) { return a - b; })));
  renderBmList();
}
function renderBmList() {
  var box = $('#bmList');
  if (!bms.size) { box.innerHTML = '<em>No bookmarks yet — press ☆ Mark while reading.</em>'; }
  else {
    box.innerHTML = '';
    Array.from(bms).sort(function (a, b) { return a - b; }).forEach(function (p) {
      var c = document.createElement('span');
      c.className = 'bm-chip'; c.dataset.go = p;
      c.textContent = 'p.' + (2 * p + 1) + '–' + (2 * p + 2);
      box.appendChild(c);
    });
  }
  bmCount.textContent = bms.size ? bms.size : '';
}
btnMark.addEventListener('click', function () {
  var p = f - 1;
  if (p < 0 || p >= BOOK.spreads.length) { toast('Open a page-spread first to bookmark it.'); return; }
  if (bms.has(p)) { bms.delete(p); toast('Bookmark removed.'); }
  else { bms.add(p); Snd.tick(); toast('🔖 Spread marked! Find it in ☰ Contents.'); }
  saveBms(); syncUI();
});

/* ---------------- contents drawer ---------------- */
(function buildDrawerToc() {
  var html = '';
  BOOK.order.forEach(function (pid) {
    var P = BOOK.parts[pid];
    var chs = BOOK.chapters.filter(function (c) { return c.partId === pid; });
    if (!chs.length) return;
    html += '<div class="toc-part" style="--pc:' + P.color + '"><i></i>' + P.label + '</div>';
    chs.forEach(function (c) {
      html += '<div class="dr-row" data-go="' + c.idx + '"><span class="n">' + pad2(c.num) +
        '</span><span class="t">' + c.title + '</span><span class="p">' + (2 * c.idx + 1) + '</span></div>';
    });
  });
  $('#tocList').innerHTML = html;
})();
function toggleDrawer(forceBm) {
  var open = forceBm ? true : !drawer.classList.contains('open');
  drawer.classList.toggle('open', open);
  if (open && forceBm) $('.dr-bm').scrollIntoView({ behavior: 'smooth', block: 'end' });
}
$('#btnToc').addEventListener('click', function () { toggleDrawer(); });
$('#btnBm').addEventListener('click', function () { toggleDrawer(true); });
$('#drClose').addEventListener('click', function () { drawer.classList.remove('open'); });

/* ---------------- global clicks ---------------- */
document.addEventListener('click', function (e) {
  var g = e.target.closest('[data-go]');
  if (g) { goTo(parseInt(g.dataset.go, 10) + 1, true); drawer.classList.remove('open'); closeSearch(); }
  if (!e.target.closest('.tb-search')) closeSearch();
});
bookEl.addEventListener('click', function (e) {
  if (e.target.closest('[data-go]')) return;
  if (f === 0 && e.target.closest('.face.front .cover')) goNext();
  else if (f === N && e.target.closest('.face.back .backcov')) goTo(N - 1, true);
});
$('#hsPrev').addEventListener('click', goPrev);
$('#hsNext').addEventListener('click', goNext);
btnPrev.addEventListener('click', goPrev);
btnNext.addEventListener('click', goNext);

/* ---------------- touch swipe (mobile single-page mode) ---------------- */
/* Only dx was checked before, so a mostly-vertical drag (scrolling a tall
   paragraph/code block with a finger) that happened to also drift >40px
   sideways — very common with real fingers — fired a page flip mid-scroll.
   Require the gesture to be clearly more horizontal than vertical before
   treating it as a page-turn swipe. */
var touchX = null, touchY = null;
wrapEl.addEventListener('touchstart', function (e) {
  if (!isMobile || e.touches.length !== 1) { touchX = null; touchY = null; return; }
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
}, { passive: true });
wrapEl.addEventListener('touchend', function (e) {
  if (touchX == null) return;
  var dx = e.changedTouches[0].clientX - touchX;
  var dy = e.changedTouches[0].clientY - touchY;
  touchX = null; touchY = null;
  if (Math.abs(dx) < 40) return;
  if (Math.abs(dx) < Math.abs(dy) * 1.2) return;   // mostly vertical → scroll, not a page swipe
  if (dx < 0) goNext(); else goPrev();
});
scrub.addEventListener('input', function () { goTo(parseInt(scrub.value, 10), true); });

/* ---------------- sound / theme / fullscreen ---------------- */
function soundIcon() { $('#btnSound').textContent = Snd.isMuted() ? '🔇' : '🔊'; }
$('#btnSound').addEventListener('click', function () { Snd.toggle(); soundIcon(); toast(Snd.isMuted() ? '🔇 Sounds off' : '🔊 Sounds on'); });

function applyTheme() {
  var n = localStorage.getItem('jb_night') === '1';
  document.body.classList.toggle('night', n);
  $('#btnTheme').textContent = n ? '☀️' : '🌙';
}
$('#btnTheme').addEventListener('click', function () {
  localStorage.setItem('jb_night', document.body.classList.contains('night') ? '0' : '1');
  applyTheme();
});
$('#btnFs').addEventListener('click', function () {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(function () {});
  } else if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(function () {});
  } else {
    toast('Fullscreen isn’t supported on this browser.');
  }
  setTimeout(fit, 350);
});

/* ---------------- toasts ---------------- */
function toast(msg, action, cb) {
  var t = document.createElement('div'); t.className = 'toast';
  var s = document.createElement('span'); s.innerHTML = msg; t.appendChild(s);
  if (action) {
    var b = document.createElement('button'); b.textContent = action;
    b.addEventListener('click', function () { cb && cb(); kill(); });
    t.appendChild(b);
  }
  $('#toastZone').appendChild(t);
  function kill() { t.classList.add('out'); setTimeout(function () { t.remove(); }, 330); }
  setTimeout(kill, action ? 8000 : 3600);
}

/* ---------------- full-text search ---------------- */
var sIndex = null;
function buildIndex() {
  sIndex = pages.map(function (p, i) {
    var d = document.createElement('div');
    d.innerHTML = p.raw ? p.html : ((p.kicker ? p.kicker + ' ' : '') + (p.head ? p.head + ' ' : '') + p.html);
    return { flips: Math.ceil(i / 2), num: p.num || null, txt: d.textContent.replace(/\s+/g, ' ').toLowerCase() };
  });
}
function closeSearch() { searchRes.hidden = true; searchRes.innerHTML = ''; }
function doSearch(qRaw) {
  var q = qRaw.trim().toLowerCase();
  if (q.length < 2) { closeSearch(); return; }
  if (!sIndex) buildIndex();
  var out = '', hits = 0;
  for (var i = 0; i < sIndex.length && hits < 22; i++) {
    var pos = sIndex[i].txt.indexOf(q);
    if (pos === -1) continue;
    hits++;
    var snip = sIndex[i].txt.slice(Math.max(0, pos - 42), pos + 78).replace(/</g, '&lt;');
    var lab = sIndex[i].num != null ? 'p.' + sIndex[i].num : (i === 0 ? 'Cover' : 'Back');
    out += '<button class="sr-item" data-flips="' + sIndex[i].flips + '"><b>' + lab +
      '</b> …' + snip + '…</button>';
  }
  searchRes.innerHTML = out || '<div class="sr-empty">No matches in the book 🤷‍♂️</div>';
  searchRes.hidden = false;
}
searchBox.addEventListener('input', function () {
  clearTimeout(searchBox._t);
  searchBox._t = setTimeout(function () {
    if (REMOTE) remoteSearch(searchBox.value);
    else doSearch(searchBox.value);
  }, 160);
});
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
/* server-side FTS via the search_spreads RPC — no client-side text index */
function remoteSearch(qRaw) {
  var q = qRaw.trim();
  if (q.length < 2) { closeSearch(); return; }
  SRC.search(q).then(function (list) {
    var out = '';
    list.forEach(function (h) {
      var snip = h.txt.replace(/\s+/g, ' ').trim().slice(0, 150)
                      .replace(/&/g, '&amp;').replace(/</g, '&lt;');
      out += '<button class="sr-item" data-flips="' + h.flips +
             '"><b>p.' + h.num + '</b> …' + snip + '…</button>';
    });
    searchRes.innerHTML = out ||
      '<div class="sr-empty">No matches in the book 🤷‍♂️</div>';
    searchRes.hidden = false;
    void esc; /* kept for future snippet paths */
  }).catch(function () {
    searchRes.innerHTML =
      '<div class="sr-empty">Search backend unreachable</div>';
    searchRes.hidden = false;
  });
}
searchBox.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    var first = searchRes.querySelector('[data-flips]');
    if (first) { goTo(parseInt(first.dataset.flips, 10), true); closeSearch(); searchBox.blur(); }
  } else if (e.key === 'Escape') { closeSearch(); searchBox.blur(); }
});
searchRes.addEventListener('click', function (e) {
  var b = e.target.closest('[data-flips]');
  if (b) { goTo(parseInt(b.dataset.flips, 10), true); closeSearch(); }
});

/* ---------------- keyboard ---------------- */
/* Space/PageDown/PageUp double as "scroll down/up" almost everywhere on the
   web — readers reflexively hit them to move through a long paragraph or a
   tall code block. If we always treat them as page-turns, content that
   hasn't finished scrolling gets yanked away mid-read. Scroll the CURRENT
   page's content first; only flip once it's already at that edge (or has
   nothing to scroll). ArrowLeft/Right are left as immediate page-turns —
   they don't double as scroll keys, so there's nothing to disambiguate. */
function currentPageBodies() {
  function pgBody(leafIdx, front) {
    var l = leaves[leafIdx];
    var face = l && (front ? l.firstChild : l.lastChild);
    return face && face.querySelector('.pg-body');
  }
  var out = [];
  if (isMobile) {
    var pb = mFront ? (f < N && pgBody(f, true)) : (f > 0 && pgBody(f - 1, false));
    if (pb) out.push(pb);
  } else {
    if (f > 0) { var b = pgBody(f - 1, false); if (b) out.push(b); }
    if (f < N) { var fr = pgBody(f, true); if (fr) out.push(fr); }
  }
  return out;
}
function scrollCurrentPages(dir) {   // dir: 1 = down, -1 = up. Returns true if it actually scrolled.
  var moved = false;
  currentPageBodies().forEach(function (el) {
    var can = dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
    if (can) { el.scrollBy({ top: dir * el.clientHeight * 0.85, behavior: 'smooth' }); moved = true; }
  });
  return moved;
}
document.addEventListener('keydown', function (e) {
  var tag = (e.target.tagName || '').toUpperCase();
  var typing = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
  if (e.key === 'Escape') { closeSearch(); drawer.classList.remove('open'); if (typing) e.target.blur(); return; }
  if (typing) return;
  switch (e.key) {
    case 'ArrowRight': e.preventDefault(); goNext(); break;
    case 'ArrowLeft': e.preventDefault(); goPrev(); break;
    case 'PageDown': case ' ': e.preventDefault(); if (!scrollCurrentPages(1)) goNext(); break;
    case 'PageUp': e.preventDefault(); if (!scrollCurrentPages(-1)) goPrev(); break;
    case 'Home': e.preventDefault(); goTo(0, true); break;
    case 'End': e.preventDefault(); goTo(N, true); break;
    case '/': e.preventDefault(); searchBox.focus(); searchBox.select(); break;
    case 't': case 'T': toggleDrawer(); break;
    case 'b': case 'B': toggleDrawer(true); break;
    case 'm': case 'M': $('#btnSound').click(); break;
    case 'n': case 'N': $('#btnTheme').click(); break;
    case 'f': case 'F': $('#btnFs').click(); break;
  }
});

/* ---------------- responsive fit ---------------- */
function fit() {
  checkMobile();
  var r = wrapEl.getBoundingClientRect();
  var bw = isMobile ? 605 : 1210;
  var s = Math.min(r.width / bw, r.height / 800, isMobile ? 1.3 : 1.06);
  curS = Math.max(0.28, s);
  bookEl.style.setProperty('--s', curS.toFixed(3));
  applyPan(true);
}
window.addEventListener('resize', fit);
/* rotating a phone fires orientationchange; some browsers skip the resize event
   until the URL bar settles, so re-fit twice */
window.addEventListener('orientationchange', function () {
  setTimeout(fit, 60); setTimeout(fit, 400);
});

/* ---------------- init ---------------- */
applyTheme(); soundIcon(); syncUI(); renderBmList(); fit();

var savedPos = parseInt(localStorage.getItem('jb_pos') || '0', 10) || 0;
if (savedPos >= 1 && savedPos <= N) {
  toast('Welcome back, reader! You stopped at <strong>' +
    (savedPos === N ? 'the end' : 'pages ' + (2 * savedPos - 1) + '–' + (2 * savedPos)) + '</strong>.',
    'Continue →', function () { goTo(savedPos, false); });
}
setTimeout(function () { $('#loader').classList.add('hide'); }, 420);

window.__book = { goToSpread: function (p) { goTo(p + 1, true); }, state: function () { return { flipped: f, sheets: N, spreads: BOOK.spreads.length, chapters: BOOK.chapters.length }; } };
})();



