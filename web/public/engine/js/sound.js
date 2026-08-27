/* ================= Book sounds — synthesized, zero asset files ================= */
window.BookSound = (function () {
  'use strict';
  let ctx = null;
  let muted = localStorage.getItem('jb_mute') === '1';

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noiseBuf(c, dur) {
    const n = Math.max(1, (c.sampleRate * dur) | 0);
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  /* airy paper swish: filtered noise burst with sweeping band-pass */
  function flip() {
    if (muted) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuf(c, 0.34);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.85;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2800, t + 0.14);
    bp.frequency.exponentialRampToValueAtTime(420, t + 0.32);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.20, t + 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.33);
    src.connect(bp); bp.connect(g); g.connect(c.destination);
    src.start(t); src.stop(t + 0.35);
  }
  /* soft UI tick */
  function tick() {
    if (muted) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = 1350;
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.05);
  }
  /* book-closing thump */
  function thump() {
    if (muted) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.16);
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.26);
  }
  function toggle() {
    muted = !muted;
    localStorage.setItem('jb_mute', muted ? '1' : '0');
    if (!muted) tick();
    return muted;
  }
  return { flip, tick, thump, toggle, isMuted: () => muted };
})();
