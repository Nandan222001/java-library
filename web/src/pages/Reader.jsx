import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { mountReader } from '../lib/engineLoader.js';

/* The legacy engine is imperatively mounted into `host`. The host MUST stay
 * mounted for the whole lifetime of this page, even while overlays (loading /
 * paywall / error) are shown on top of it — book.js measures it during init. */
export default function Reader() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { refreshMe } = useAuth();
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