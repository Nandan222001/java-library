import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './Reveal.jsx';

/* How far a page rotates once fully turned — matches the small decorative
 * page-flip already used in the Reader Showcase section (.lp-fb-leaf),
 * so the two page-turn animations on this site agree with each other. */
const MAX_ROTATE = -172;

/** FlipStory — a stack of "book pages" pinned to the viewport while the
 * section scrolls past; each page rotates open in its own slice of that
 * scroll distance, turning to reveal the next one underneath.
 *
 * Plain scroll-listener + direct style writes (rAF-throttled), matching
 * the rest of this page's hand-rolled scroll work (see Landing.jsx's own
 * progress bar) rather than a motion library or CSS scroll-timelines —
 * this project deliberately ships neither, and scroll-timelines still
 * don't work everywhere, which would silently hide these pages' content
 * instead of just losing a flourish. Skips all of it under reduced
 * motion and renders the same four points as a plain static grid instead. */
export default function FlipStory({ pages }) {
  const reduced = prefersReducedMotion();
  const trackRef = useRef(null);
  const pageRefs = useRef([]);

  useEffect(() => {
    if (reduced) return;
    const track = trackRef.current;
    if (!track) return;
    const n = pages.length;
    let raf = 0;

    const update = () => {
      raf = 0;
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

      pageRefs.current.forEach((el, i) => {
        if (!el) return;
        const local = Math.min(1, Math.max(0, progress * n - i));
        el.style.transform = `rotateY(${local * MAX_ROTATE}deg)`;
        const shade = el.lastElementChild;
        if (shade) shade.style.opacity = String(Math.min(1, local * 1.4));
      });
    };

    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced, pages.length]);

  if (reduced) {
    return (
      <div className="lp-flip-static">
        {pages.map(p => (
          <div className="lp-flip-static-card" key={p.title}>
            <span className="ico">{p.icon}</span>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="lp-flip-track" ref={trackRef} style={{ height: `${pages.length * 100}vh` }}>
      <div className="lp-flip-stage">
        <div className="lp-flip-book">
          {pages.map((p, i) => (
            <div
              className="lp-flip-page"
              key={p.title}
              ref={el => (pageRefs.current[i] = el)}
              style={{ zIndex: pages.length - i }}
            >
              <div className="sheet">
                <div className="face">
                  <span className="ico">{p.icon}</span>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              </div>
              <span className="shade" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
