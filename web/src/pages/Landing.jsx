import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  BOOKS, FEATURES, FOOTER_LINKS, HERO_STATS, NAV_LINKS, PLANS,
  PRACTICE_POINTS, PRICING_ASSURANCES, SLIDES, SPREADS_PER_BOOK,
  TESTIMONIALS, VIDEOS, FEATURED,
} from '../lib/landingContent.js';
import '../landing.css';

const SLIDE_MS = 6500;

/* ------------------------- top hero carousel ------------------------- */
function HeroCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = SLIDES.length;

  const go = useCallback(n => setIdx(i => (i + n + count) % count), [count]);

  useEffect(() => {
    if (paused) return undefined;
    const t = setInterval(() => go(1), SLIDE_MS);
    return () => clearInterval(t);
  }, [paused, go]);

  return (
    <div
      className="dl-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Digital Library highlights"
    >
      <div className="dl-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {SLIDES.map((s, i) => (
          <div
            key={s.h1}
            className="dl-slide"
            aria-hidden={i !== idx}
            role="group"
            aria-label={`Slide ${i + 1} of ${count}`}
          >
            <div className="dl-slide-copy">
              <span className="dl-badge">{s.badge}</span>
              <h1>
                {s.h1}
                <br />
                <span className="dl-grad">{s.h2}</span>
              </h1>
              <p>{s.lead}</p>
              <div className="dl-cta-row">
                <Link to="/signup" className="dl-btn primary">{s.primary} →</Link>
                <a href="#videos" className="dl-btn ghost"><span className="play">▶</span> {s.secondary}</a>
              </div>
            </div>
            <div className="dl-slide-art">
              <img src={s.img} alt={s.alt} loading={i === 0 ? 'eager' : 'lazy'} />
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="dl-car-btn prev" aria-label="Previous slide" onClick={() => go(-1)}>‹</button>
      <button type="button" className="dl-car-btn next" aria-label="Next slide" onClick={() => go(1)}>›</button>

      <div className="dl-dots" role="tablist" aria-label="Choose slide">
        {SLIDES.map((s, i) => (
          <button
            key={s.h1}
            type="button"
            className={i === idx ? 'on' : ''}
            aria-label={`Go to slide ${i + 1}`}
            aria-selected={i === idx}
            role="tab"
            onClick={() => setIdx(i)}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ page ------------------------------ */
export default function Landing() {
  const { user } = useAuth();
  const startTo = user ? '/library' : '/signup';

  return (
    <div className="dl">
      {/* ============================ NAV ============================ */}
      <header className="dl-nav">
        <div className="dl-nav-in">
          <Link to="/" className="dl-brand">
            <span className="dl-logo">📘</span>
            <span>
              <b>Digital Library</b>
              <i>Read · Learn · Grow</i>
            </span>
          </Link>

          <nav className="dl-links" aria-label="Primary">
            {NAV_LINKS.map(l =>
              l.hash ? (
                <a key={l.label} href={l.hash} className={l.label === 'Home' ? 'on' : ''}>{l.label}</a>
              ) : (
                <Link key={l.label} to={l.to} className={l.label === 'Home' ? 'on' : ''}>{l.label}</Link>
              ),
            )}
          </nav>

          <div className="dl-nav-cta">
            <button type="button" className="dl-icon" aria-label="Search books">🔍</button>
            <Link to="/login" className="dl-btn outline sm">Login</Link>
            <Link to={startTo} className="dl-btn primary sm">Get Started</Link>
          </div>
        </div>
      </header>

      {/* ============================ HERO ============================ */}
      <section className="dl-hero" id="top">
        <HeroCarousel />
        <div className="dl-wrap">
          <ul className="dl-stats">
            {HERO_STATS.map(s => (
              <li key={s.label}>
                <span className="ic">{s.icon}</span>
                <b>{s.value}</b>
                <i>{s.label}</i>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ========================= WHY CHOOSE ========================= */}
      <section className="dl-section" id="features">
        <div className="dl-wrap">
          <div className="dl-head center">
            <h2>Why Choose Digital Library?</h2>
            <p>More than just books — it&apos;s your complete learning ecosystem.</p>
          </div>
          <div className="dl-features">
            {FEATURES.map(f => (
              <article key={f.title} className="dl-feature">
                <span className="ico" style={{ background: `${f.tint}1a`, color: f.tint }}>{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ========================== LIBRARY ========================== */}
      <section className="dl-section tinted" id="library">
        <div className="dl-wrap">
          <div className="dl-head row">
            <div>
              <span className="dl-eyebrow">OUR LIBRARY</span>
              <h2>15 Books. One Goal.</h2>
              <p>Master the skills that matter. From core programming to system design, cybersecurity and career growth.</p>
            </div>
            <a className="dl-more" href="#pricing">View All Books →</a>
          </div>

          <div className="dl-books">
            {BOOKS.map(b => (
              <article key={b.title} className="dl-book">
                <div className="shot"><img src={b.cover} alt={`${b.title} book cover`} loading="lazy" /></div>
                <h3>{b.title}</h3>
                <span>{b.chapters} Chapters</span>
                <span>~ {SPREADS_PER_BOOK} Spreads</span>
              </article>
            ))}

            <aside className="dl-shelf-sum">
              <img src="/landing/books-stack.jpg" alt="Stack of colorful books" loading="lazy" />
              <div>
                <b>15 Books</b>
                <b>450+ Chapters</b>
                <b>750+ Spreads</b>
                <b className="blue">Unlimited Growth</b>
              </div>
              <a href="#pricing" className="dl-round" aria-label="See plans">→</a>
            </aside>
          </div>
        </div>
      </section>

      {/* ========================= FEATURED BOOK ========================= */}
      <section className="dl-section dark" id="featured">
        <div className="dl-wrap dl-featured">
          <div className="dl-player">
            <img src={FEATURED.img} alt="System Design course player preview" loading="lazy" />
          </div>
          <div className="dl-featured-copy">
            <span className="dl-eyebrow">FEATURED BOOK</span>
            <h2>{FEATURED.title}</h2>
            <b className="sub">{FEATURED.tagline}</b>
            <p>{FEATURED.body}</p>
            <ul className="dl-checks">
              {FEATURED.points.map(pt => (
                <li key={pt}><span>✓</span>{pt}</li>
              ))}
            </ul>
            <Link to={startTo} className="dl-btn primary">Watch Full Preview →</Link>
          </div>
        </div>
      </section>

      {/* ====================== INTERACTIVE LEARNING ====================== */}
      <section className="dl-section lavender" id="practice">
        <div className="dl-wrap">
          <div className="dl-head">
            <span className="dl-eyebrow">INTERACTIVE LEARNING</span>
            <h2>Learn with Practice. Master with MCQs.</h2>
            <p>Each chapter comes with MCQs, quizzes and progress tracking to help you stay on track and measure your growth.</p>
          </div>
          <div className="dl-split">
            <div className="dl-laptop"><img src="/landing/mcq-laptop-light.jpg" alt="Quiz interface on a laptop" loading="lazy" /></div>
            <ul className="dl-points">
              {PRACTICE_POINTS.map(p => (
                <li key={p.title}>
                  <span className="ico" style={{ background: `${p.tint}1a`, color: p.tint }}>{p.icon}</span>
                  <div><b>{p.title}</b><i>{p.body}</i></div>
                </li>
              ))}
            </ul>
          </div>
          <span className="dl-hand right">Small<br />steps<br />Big<br />Dreams ✏️</span>
        </div>
      </section>

      {/* ======================== SEE IT IN ACTION ======================== */}
      <section className="dl-section lavender2">
        <div className="dl-wrap">
          <div className="dl-head">
            <span className="dl-eyebrow">SEE IT IN ACTION</span>
            <h2>Watch Our Platform. Master with MCQs.</h2>
            <p>Get a quick tour of how Digital Library works — from reading books to taking quizzes and tracking your progress.</p>
          </div>
          <div className="dl-split flip">
            <div className="dl-laptop"><img src="/landing/mcq-laptop-dark.jpg" alt="Dark themed quiz interface on a laptop" loading="lazy" /></div>
            <ul className="dl-points">
              {PRACTICE_POINTS.map(p => (
                <li key={p.title}>
                  <span className="ico" style={{ background: `${p.tint}1a`, color: p.tint }}>{p.icon}</span>
                  <div><b>{p.title}</b><i>{p.body}</i></div>
                </li>
              ))}
            </ul>
          </div>
          <span className="dl-hand right">Small<br />steps<br />Big<br />Dreams ✏️</span>
        </div>
      </section>

      {/* ========================== VIDEO TOUR ========================== */}
      <section className="dl-section night" id="videos">
        <div className="dl-wrap">
          <div className="dl-head">
            <span className="dl-eyebrow">SEE THE PLATFORM</span>
            <h2>Watch Our Platform in Action</h2>
            <p>Get a quick tour of how Digital Library works — from reading books to taking quizzes and tracking your progress.</p>
          </div>
          <div className="dl-videos">
            {VIDEOS.map(v => (
              <article key={v.title} className="dl-video">
                <div className="thumb">
                  <img src={v.thumb} alt={`${v.title} video thumbnail`} loading="lazy" />
                  <span className="play">▶</span>
                  <b className="time">{v.time}</b>
                </div>
                <h3>{v.title}</h3>
              </article>
            ))}
          </div>
          <span className="dl-hand light right">Learn.<br />Grow.<br />Brighter<br />Future ✨</span>
        </div>
      </section>

      {/* ========================= TESTIMONIALS ========================= */}
      <section className="dl-section" id="stories">
        <div className="dl-wrap">
          <div className="dl-head">
            <span className="dl-eyebrow">SUCCESS STORIES</span>
            <h2>Real People. Real Progress.</h2>
            <p>Join thousands of learners who are building their dream careers with Digital Library.</p>
          </div>
          <div className="dl-quotes">
            {TESTIMONIALS.map(t => (
              <article key={t.name} className="dl-quote">
                <header>
                  <img src={t.avatar} alt={`Portrait of ${t.name}`} loading="lazy" />
                  <div><b>{t.name}</b><i>{t.role}</i></div>
                </header>
                <p>“{t.quote}”</p>
                <span className="stars" aria-label="5 star rating">★★★★★</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* =========================== PRICING =========================== */}
      <section className="dl-section tinted" id="pricing">
        <div className="dl-wrap">
          <div className="dl-head">
            <span className="dl-eyebrow">SIMPLE &amp; TRANSPARENT</span>
            <h2>Choose the Plan That Fits You</h2>
            <p>Start with the free forever plan. Upgrade anytime.</p>
          </div>

          <div className="dl-pricing">
            {PLANS.map(p => (
              <article key={p.name} className={`dl-plan ${p.badge === 'Most Popular' ? 'hot' : ''}`}>
                {p.badge && <span className={`flag ${p.badge === 'Most Popular' ? 'blue' : 'gold'}`}>{p.badge}</span>}
                <b className="name">{p.name}</b>
                <div className="price">{p.price} <small>{p.period}</small></div>
                <ul>{p.features.map(f => <li key={f}>✓ {f}</li>)}</ul>
                <Link to={p.name === 'Free' ? '/signup' : '/pricing'} className={`dl-btn ${p.name === 'Free' ? 'outline blue' : 'primary'}`}>{p.cta}</Link>
              </article>
            ))}

            <aside className="dl-assure">
              {PRICING_ASSURANCES.map(a => (
                <div key={a.title}>
                  <span className="ico">{a.icon}</span>
                  <div><b>{a.title}</b><i>{a.body}</i></div>
                </div>
              ))}
            </aside>
          </div>
        </div>
      </section>

      {/* ========================= FINAL CTA ========================= */}
      <section className="dl-final">
        <div className="dl-wrap dl-final-in">
          <div>
            <h2>Ready to Build Your Future?</h2>
            <p>Join thousands of learners and start your journey today.</p>
          </div>
          <div className="dl-final-cta">
            <Link to={startTo} className="dl-btn primary big">Get Started Now →</Link>
            <i>No credit card required.</i>
          </div>
        </div>
      </section>

      {/* =========================== FOOTER =========================== */}
      <footer className="dl-foot">
        <div className="dl-wrap">
          <div className="dl-foot-top">
            <Link to="/" className="dl-brand">
              <span className="dl-logo">📘</span>
              <span><b>Digital Library</b><i>Read · Learn · Grow</i></span>
            </Link>
            <nav className="dl-foot-links" aria-label="Footer">
              {FOOTER_LINKS.map(l => (
                <a key={l} href={l === 'Home' ? '#top' : `#${l.toLowerCase()}`}>{l}</a>
              ))}
            </nav>
            <div className="dl-social" aria-label="Social links">
              <span>✉</span><span>𝕏</span><span>in</span><span>gh</span>
            </div>
          </div>
          <div className="dl-foot-bottom">
            <span>© 2025 Digital Library. All rights reserved.</span>
            <span className="dl-legal">
              <a href="#top">Privacy Policy</a>
              <a href="#top">Terms of Service</a>
              <a href="#top">Contact</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
