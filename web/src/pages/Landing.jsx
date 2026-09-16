import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/supabase.js';
import { AmbientVideo, CountUp, Reveal, prefersReducedMotion } from '../components/Reveal.jsx';
import { BOOKS, FAQS, FEATURES, PLANS_FALLBACK, STATS, STEPS, TOPICS } from '../lib/landingContent.js';
import { Money } from '../lib/money.jsx';
import '../landing.css';

/* Headline rendered word-by-word so each word can swing in on its own delay.
 * "FAANG" carries the amber gradient. */
const H1_WORDS = [
  { t: 'From' }, { t: 'zero' }, { t: 'to' }, { t: 'FAANG,', cls: 'grad' },
  { t: 'one' }, { t: 'flipped' }, { t: 'page' }, { t: 'at' }, { t: 'a' }, { t: 'time.' },
];

function priceLabel(plan) {
  if (!plan.price_paise) return { paise: 0, period: 'forever' };
  if (plan.interval_days === 365) return { paise: plan.price_paise, period: '/ year' };
  if (plan.interval_days === 30) return { paise: plan.price_paise, period: '/ month' };
  return { paise: plan.price_paise, period: `/${plan.interval_days}d` };
}

export default function Landing() {
  const { user } = useAuth();
  const heroRef = useRef(null);
  const barRef = useRef(null);
  const [plans, setPlans] = useState(PLANS_FALLBACK);
  const [openFaq, setOpenFaq] = useState(0);

  const primaryTo = user ? '/library' : '/signup';
  const primaryLabel = user ? 'Open your library' : 'Start reading free';

  /* ---------- scroll progress bar (rAF-throttled) ---------- */
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
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
  }, []);

  /* ---------- smooth in-page anchors, but never against the user's wishes ---------- */
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
    return () => { html.style.scrollBehavior = prev; };
  }, []);

  /* ---------- live plans (falls back to the seeded catalog) ---------- */
  useEffect(() => {
    let alive = true;
    api('/api/billing/plans')
      .then(d => { if (alive && Array.isArray(d) && d.length) setPlans(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  /* ---------- hero parallax: pointer position → CSS vars ---------- */
  const onHeroMove = useCallback(e => {
    const el = heroRef.current;
    if (!el || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
  }, []);

  /* ---------- feature-card cursor glow ---------- */
  const onCardMove = useCallback(e => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--gx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
    e.currentTarget.style.setProperty('--gy', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
  }, []);

  const marquee = useMemo(() => [...TOPICS, ...TOPICS], []);

  return (
    <>
      {/* kept outside .lp so the fixed bar is never affected by the page's
          overflow clipping */}
      <div className="lp-progress" ref={barRef} aria-hidden="true" />

      <div className="lp">
      {/* ================= HERO ================= */}
      <section
        className="lp-hero"
        id="top"
        ref={heroRef}
        onMouseMove={onHeroMove}
        onMouseLeave={() => {
          const el = heroRef.current;
          if (el) { el.style.setProperty('--mx', 0); el.style.setProperty('--my', 0); }
        }}
      >
        <AmbientVideo
          className="lp-hero-video"
          src="/landing/video/hero-loop.mp4"
          poster="/landing/hero-library.jpg"
          autoPlay
        />
        <div className="lp-hero-scrim" />
        <div className="lp-hero-glow" />

        <div className="lp-wrap lp-hero-grid">
          <div>
            <span className="lp-badge">
              <span className="dot" />
              {user ? 'You are signed in · reading now' : 'Free plan · no card needed'}
            </span>

            {/* the space between words is a real text node, outside the inline
                blocks, so the heading still wraps on narrow screens */}
            <h1 className="lp-h1">
              {H1_WORDS.map((w, i) => (
                <span key={i}>
                  <span className={`w ${w.cls || ''}`} style={{ '--i': i }}>{w.t}</span>
                  {i < H1_WORDS.length - 1 ? ' ' : ''}
                </span>
              ))}
            </h1>

            <p className="lp-lede-hero">
              A real digital-books library for Java interview prep: a page-flip reader,
              {' '}{BOOKS.length} deep-dive books, and progress that follows you everywhere.
            </p>

            <div className="lp-cta-row">
              <Link to={primaryTo} className="btn primary lp-shine">{primaryLabel} →</Link>
              <a href="#library" className="btn ghost">See the shelf</a>
            </div>
          </div>

          <div className="lp-hero-art" aria-hidden="true">
            <div className="halo" />
            <div className="lp-float f1"><div className="lp-float-in"><img src="/landing/cover-java.jpg" alt="" /></div></div>
            <div className="lp-float f2"><div className="lp-float-in"><img src="/landing/cover-dsa.jpg" alt="" /></div></div>
            <div className="lp-float f3"><div className="lp-float-in"><img src="/landing/cover-spring.jpg" alt="" /></div></div>
          </div>
        </div>
      </section>

      {/* ================= TOPIC MARQUEE ================= */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {marquee.map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      {/* ================= STATS ================= */}
      <section className="lp-section tight">
        <div className="lp-wrap">
          <div className="lp-stats">
            {STATS.map((s, i) => (
              <Reveal key={s.label} className="lp-stat" delay={i * 90} style={{ '--sa': ['linear-gradient(90deg,var(--accent),var(--accent-2))', 'linear-gradient(90deg,var(--teal),#7fd8cf)', 'linear-gradient(90deg,var(--gold),#f3d27a)', 'linear-gradient(90deg,var(--green),#8fd6a6)'][i] }}>
                <span className="ico">{s.icon}</span>
                <div className="num"><CountUp value={s.value} suffix={s.suffix} /></div>
                <b className="lbl">{s.label}</b>
                <span className="sub">{s.sub}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= LIBRARY ================= */}
      <section className="lp-section paper" id="library">
        <div className="lp-wrap">
          <Reveal className="lp-head">
            <span className="lp-eyebrow">The shelf</span>
            <h2 className="lp-h2">Five books. One interview loop.</h2>
            <p className="lp-lede">
              Start on the free Java 8 → 17 title, then unlock Spring Boot, DSA, SQL and System
              Design. Every book is written as spreads: theory on the left page, drills and
              dry-runs on the right.
            </p>
          </Reveal>

          <div className="lp-library-grid">
            <Reveal className="lp-reel-frame" delay={80}>
              <div className="lp-reel">
                <AmbientVideo
                  className="lp-reel-video"
                  src="/landing/video/shelf-reel.mp4"
                  poster="/landing/cover-java.jpg"
                />
                <span className="lp-reel-live"><span className="dot" />Shelf preview</span>
              </div>
              <p className="lp-reel-cap">
                A loop over the covers. The reader itself flips page by page.
              </p>
            </Reveal>

            <div className="lp-books">
              {BOOKS.map((b, i) => (
                <Reveal
                  key={b.slug}
                  as={Link}
                  to={user ? '/library' : '/signup'}
                  className="lp-book"
                  delay={i * 70}
                  style={{ '--ba': `${b.accent}66` }}
                >
                  <div className="shot">
                    <img src={b.cover} alt={`${b.title} cover`} loading="lazy" />
                    <span className="shine" />
                    <span className={`chip tier ${b.tier === 'free' ? 'free' : 'premium'}`}>
                      {b.tier === 'free' ? 'Free' : 'Premium'}
                    </span>
                    <div className="meta">
                      <h3>{b.emoji} {b.title}</h3>
                      <span className="em">{b.subtitle}</span>
                    </div>
                  </div>
                  <p className="sub">
                    <b>{b.tier === 'free' ? 'Read it now' : 'Unlock with Premium'}</b>: full
                    spread-by-spread content, bookmarks and its own practice bank.
                  </p>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal className="lp-shelf-cta" delay={120}>
            <Link to={user ? '/library' : '/signup'} className="btn primary">
              {user ? 'Open the library' : 'Create a free account'} →
            </Link>
            <span className="muted">Free Forever opens every free book, no card needed.</span>
          </Reveal>
        </div>
      </section>

      {/* ================= READER SHOWCASE ================= */}
      <section className="lp-section" id="reader">
        <div className="lp-wrap lp-showcase">
          <Reveal>
            <div className="lp-device">
              <img src="/landing/reader-device.jpg" alt="The Java Library reader open on a tablet" loading="lazy" />
              <span className="scan" aria-hidden="true" />
              <span className="lp-chipfloat a" aria-hidden="true">📖 Two-page spread</span>
              <span className="lp-chipfloat b" aria-hidden="true">🌙 Night mode</span>
              <span className="lp-chipfloat c" aria-hidden="true"><span className="k">Page 128</span> / 242</span>
            </div>
          </Reveal>

          <div>
            <Reveal>
              <h2 className="lp-h2">It should feel like paper, not a webpage.</h2>
              <p className="lp-lede">
                The flip-book engine was built first and the app was wrapped around it. Curl,
                sound, night mode and the contents drawer all survive on desktop and phone.
                No rebuild, no “view online” PDF.
              </p>
            </Reveal>

            <ul className="lp-checks">
              {[
                ['Real page turns', 'spreads on desktop, a single crisp page on small screens'],
                ['Bookmarks & contents drawer', '★ any concept, jump back from the TOC'],
                ['Hotkeys', '← / → or j / k to turn, f to fullscreen, t for the drawer'],
                ['Your page, every device', 'position is saved to your account as you turn'],
              ].map(([b, rest], i) => (
                <Reveal as="li" key={b} delay={i * 80}>
                  <span className="tick">✓</span>
                  <span><b>{b}</b>: {rest}</span>
                </Reveal>
              ))}
            </ul>

            <div className="lp-flipbook" aria-hidden="true">
              <div className="lp-fb-base">
                <div className="lp-fb-side" />
                <div className="lp-fb-side right" />
              </div>
              <div className="lp-fb-leaf" />
              <div className="lp-fb-spine" />
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section className="lp-section paper" id="features">
        <div className="lp-wrap">
          <Reveal className="lp-head center">
            <h2 className="lp-h2">Built to keep you turning pages</h2>
            <p className="lp-lede">
              Most prep is a wall of text and a promise. This is a library with a spine: a
              reader you want to use, drills that check you, and progress you can see.
            </p>
          </Reveal>

          <div className="lp-features">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                className="lp-feature"
                delay={(i % 4) * 80}
                onMouseMove={onCardMove}
              >
                <span className="tag">{f.tag}</span>
                <span className="ico">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="lp-section" id="how">
        <div className="lp-wrap">
          <Reveal className="lp-head">
            <h2 className="lp-h2">From opening the cover to interview-ready</h2>
          </Reveal>

          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} className="lp-step" delay={i * 110}>
                <span className="pin"><span /></span>
                <span className="ico">{s.icon}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PRICING ================= */}
      <section className="lp-section paper" id="pricing">
        <div className="lp-wrap">
          <Reveal className="lp-head center">
            <span className="lp-eyebrow">Pricing</span>
            <h2 className="lp-h2">Start free. Upgrade when the shelf isn’t enough.</h2>
            <p className="lp-lede">
              Same plans as inside the app, no landing-page special, no hidden tier.
            </p>
          </Reveal>

          <div className="lp-plans">
            {plans.map((p, i) => {
              const { paise, period } = priceLabel(p);
              const featured = p.interval_days === 365;
              return (
                <Reveal key={p.plan_id} className="lp-plan-wrap" delay={i * 90}>
                  <div className={`lp-plan ${featured ? 'featured' : ''}`}>
                    {featured && <span className="ribbon">Best value · 2 months free</span>}
                    <span className="pname">{p.name}</span>
                    <div className="pprice">
                      <Money paise={paise}/> <small>{period}</small>
                    </div>
                    <ul>
                      {(p.features || []).map(f => <li key={f}>{f}</li>)}
                    </ul>
                    <Link
                      to={p.plan_id === 'free' ? '/signup' : '/pricing'}
                      className={`btn ${featured ? 'primary' : ''}`}
                    >
                      {p.plan_id === 'free' ? 'Get started' : 'Choose this plan'}
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>

          <Reveal className="lp-plan-note" delay={200}>
            Payments run through Razorpay’s hosted checkout with server-side signature
            verification, or the in-app sandbox gateway during development.
          </Reveal>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="lp-section" id="faq">
        <div className="lp-wrap">
          <Reveal className="lp-head center">
            <h2 className="lp-h2">Before you flip the first page</h2>
          </Reveal>

          <div className="lp-faq">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <Reveal key={f.q} className={`lp-qa ${open ? 'open' : ''}`} delay={i * 55}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? -1 : i)}
                  >
                    <span className="q-n">{String(i + 1).padStart(2, '0')}</span>
                    {f.q}
                    <span className="caret" aria-hidden="true">+</span>
                  </button>
                  <div className="lp-qa-a"><div><p>{f.a}</p></div></div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="lp-section tight">
        <div className="lp-wrap">
          <Reveal className="lp-final">
            <h2>Your next 400 questions are already indexed.</h2>
            <p>
              Create an account and the Free Forever plan opens the Java 8 → 17 book, the reader
              and Practice Mode in under a minute.
            </p>
            <div className="lp-cta-row" style={{ justifyContent: 'center', marginBottom: 0 }}>
              <Link to={primaryTo} className="btn primary lp-shine">{primaryLabel} →</Link>
              <Link to="/pricing" className="btn ghost">Compare plans</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="lp-foot">
        <div className="lp-wrap">
          <div className="lp-foot-grid">
            <div>
              <div className="brand">☕ Java <i>LIBRARY</i></div>
              <p className="copy" style={{ marginTop: 12, maxWidth: '38ch' }}>
                A React · Node · Postgres digital-books platform for Java interview prep.
              </p>
            </div>
            <nav className="lp-foot-links">
              <a href="#library">Shelf</a>
              <a href="#reader">Reader</a>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </nav>
          </div>
          <p className="copy">© {new Date().getFullYear()} Java Library · Built with React, Express and Supabase.</p>
        </div>
      </footer>
      </div>
    </>
  );
}
