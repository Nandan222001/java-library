import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { mountReader } from '../lib/engineLoader.js';

/* The legacy engine is imperatively mounted into `host`. The host MUST stay
 * mounted for the whole lifetime of this page, even while overlays (loading /
 * paywall / error) are shown on top of it — book.js measures it during init. */
/* Per-user watermark tiled across the page while reading — this is the part
 * of "screenshot protection" that's actually enforceable (see
 * lib/contentProtection.js): it can't stop a screenshot, but it stamps every
 * page with who was reading it, so a leaked copy is traceable to an
 * account. Built as a small SVG data URI rather than a library so it stays
 * dependency-free. */
function watermarkUrl(text) {
  const safe = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='200'>` +
    `<text x='180' y='104' font-family='monospace' font-size='13' fill='rgba(120,90,50,0.15)' ` +
    `text-anchor='middle' transform='rotate(-28 180 104)'>${safe}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function Reader() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { user, refreshMe } = useAuth();
  const host = useRef(null);
  const [state, setState] = useState('loading'); // loading | ok | locked | error
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let dead = false;
    let syncTimer = null;
    document.body.classList.add('is-reader');   // let engine/css/base.css own <body>

    mountReader(host.current, {
      slug,
      startFlips: parseInt(params.get('p') || '0', 10) || 0
    }).then(({ meta }) => {
      if (dead) return;
      setState('ok');
      document.title = `${meta.book.title} · Java Library`;
      window.READER = {                              // progress sync hook
        flush: window.__READER_FLUSH
      };
      syncTimer = setInterval(() => window.READER.flush?.(), 15000);
    }).catch(err => {
      if (dead) return;
      if (err.status === 402 || err.message === 'subscription_required')
        setState('locked');
      else { setState('error'); setMsg(err.message || 'Could not open the book'); }
    });

    return () => {
      dead = true;
      clearInterval(syncTimer);
      try { window.READER?.flush?.(); } catch {}
      if (host.current) host.current.innerHTML = '';
      document.body.classList.remove('is-reader');
      refreshMe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const overlay = body => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500,
                  background: 'var(--bg)',
                  display: 'grid', placeContent: 'center',
                  justifyItems: 'center', gap: 14 }}>
      {body}
      <Link to="/library" className="btn ghost" style={{ marginTop: 10 }}>
        ← Back to library
      </Link>
    </div>
  );

  return (
    <>
      <div ref={host} data-reader={slug}/>

      {state === 'ok' && user?.email && (
        <div aria-hidden="true" style={{
          position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none',
          backgroundImage: `url("${watermarkUrl(`${user.email} · ${new Date().toLocaleDateString()}`)}")`,
          backgroundRepeat: 'repeat'
        }}/>
      )}

      {state === 'loading' && overlay(
        <>
          <div className="spin"/>
          <span>Opening “{slug}” — streaming pages from Supabase…</span>
        </>
      )}

      {state === 'locked' && overlay(
        <>
          <div style={{ fontSize: 56 }}>🔒</div>
          <h2 style={{ margin: 0 }}>This title is Premium</h2>
          <p className="muted" style={{ maxWidth: 440, textAlign: 'center', margin: '4px 0 0' }}>
            A subscription unlocks every premium book in the library.
            Your saved progress is waiting.
          </p>
          <Link to="/pricing" className="btn primary">See plans →</Link>
        </>
      )}

      {state === 'error' && overlay(
        <>
          <div style={{ fontSize: 46 }}>⚠️</div>
          <div className="errbox">{msg}</div>
        </>
      )}
    </>
  );
}