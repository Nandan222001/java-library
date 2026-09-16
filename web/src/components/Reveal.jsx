/* Motion primitives for the landing page.
 *
 * Tiny on purpose — the marketing page should not pull a whole animation
 * library into a bundle that also has to boot the flip-book reader.
 * Every effect degrades to "just show the content" when the user asks for
 * reduced motion (checked in CSS, see landing.css). */
import { useEffect, useRef, useState } from 'react';

export function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** useInView — one IntersectionObserver per element, unobserved after firing. */
export function useInView({ threshold = 0.18, rootMargin = '0px 0px -8% 0px', once = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }

    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setInView(true);
          if (once) io.unobserve(e.target);
        } else if (!once) {
          setInView(false);
        }
      }
    }, { threshold, rootMargin });

    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, inView];
}

/** Reveal — fade + rise into place once the element scrolls in. */
export function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) {
  const [ref, inView] = useInView();
  return (
    <Tag
      ref={ref}
      className={`lp-reveal ${inView ? 'is-in' : ''} ${className}`}
      /* caller styles are merged, not overwritten — callers pass custom props
         like --sa/--ba and must not lose the stagger delay */
      style={{ '--d': `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** CountUp — animates 0 → value with an ease-out ramp the first time it's seen. */
export function CountUp({ value, duration = 1500, suffix = '', prefix = '' }) {
  const [ref, inView] = useInView({ threshold: 0.4 });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) { setN(value); return; }

    let raf = 0;
    const t0 = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className="lp-count">
      {prefix}{n.toLocaleString('en-IN')}{suffix}
    </span>
  );
}

/* A video with `preload="metadata"` only starts fetching actual frame data
 * once .play() fires — on a slow connection that leaves it playing from an
 * empty buffer, which looks like stutter/flicker, not motion. Skip it the
 * same way reduced-motion does and let the poster image stand in. */
function prefersLessData() {
  const c = typeof navigator !== 'undefined' && navigator.connection;
  return !!c && (c.saveData || ['slow-2g', '2g'].includes(c.effectiveType));
}

/** AmbientVideo — plays only while on screen (saves CPU/battery on a page
 *  that already has a hero video), and never plays at all under reduced
 *  motion or a slow/data-saving connection.
 *  The poster frame always renders, so there is no empty box without video. */
export function AmbientVideo({ src, poster, className = '', autoPlay = false, ...rest }) {
  const ref = useRef(null);
  const reduced = prefersReducedMotion() || prefersLessData();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) { el.pause(); el.removeAttribute('autoplay'); return; }
    if (typeof IntersectionObserver === 'undefined') { el.play().catch(() => {}); return; }

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.play().catch(() => {});
      else el.pause();
    }, { threshold: 0.2 });

    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      muted loop playsInline
      preload="metadata"
      autoPlay={autoPlay && !reduced}
      aria-hidden="true"
      {...rest}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
