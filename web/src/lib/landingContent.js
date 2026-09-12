/* Landing-page content.
 *
 * Everything here mirrors what the app actually ships (book titles/tiers come
 * from server/scripts/seed-books.mjs, plans from supabase/schema.sql) so the
 * marketing page never promises something the reader can't deliver.
 * Cover art lives in web/public/landing/ (generated for this project). */

export const BOOKS = [
  {
    slug: 'java-8-to-17',
    title: 'Java 8 → 17 Essentials',
    subtitle: 'Modern language features every interviewer expects',
    emoji: '🚀',
    tier: 'free',
    cover: '/landing/cover-java.jpg',
    accent: '#f0812f',
  },
  {
    slug: 'spring-boot-practice',
    title: 'Spring Boot in Practice',
    subtitle: 'Build real REST services with Spring Boot, end to end',
    emoji: '🍃',
    tier: 'premium',
    cover: '/landing/cover-spring.jpg',
    accent: '#4caf6d',
  },
  {
    slug: 'dsa-crash-course',
    title: 'Data Structures & Algorithms',
    subtitle: 'The patterns that keep showing up in coding interviews',
    emoji: '🧠',
    tier: 'premium',
    cover: '/landing/cover-dsa.jpg',
    accent: '#6f93e8',
  },
  {
    slug: 'sql-for-interviews',
    title: 'SQL for Interviews',
    subtitle: 'Joins, aggregations and window functions on real schemas',
    emoji: '🗄️',
    tier: 'premium',
    cover: '/landing/cover-sql.jpg',
    accent: '#3fb6ac',
  },
  {
    slug: 'system-design-basics',
    title: 'System Design Basics',
    subtitle: 'A hands-on primer for the design interview',
    emoji: '🏗️',
    tier: 'premium',
    cover: '/landing/cover-system.jpg',
    accent: '#e2b53c',
  },
];

export const STATS = [
  { icon: '❓', value: 400, suffix: '+', label: 'Interview questions', sub: 'answered page by page' },
  { icon: '📚', value: 5, suffix: '', label: 'Deep-dive books', sub: 'Java · Spring · DSA · SQL · Design' },
  { icon: '🧩', value: 24, suffix: '+', label: 'Core topics', sub: 'theory + drills on every spread' },
  { icon: '🔄', value: 100, suffix: '%', label: 'Progress synced', sub: 'phone → laptop, same page' },
];

/* Marquee under the hero — real chapters/subjects the library covers. */
export const TOPICS = [
  'Records', 'Sealed classes', 'Pattern matching', 'Streams & Collectors', 'Optional',
  'Virtual threads', 'JVM memory', 'Garbage collection', 'REST controllers', 'Spring Data JPA',
  'Bean scopes', 'Big-O', 'Two pointers', 'Sliding window', 'Dynamic programming', 'Graphs',
  'Window functions', 'Indexes', 'Query plans', 'Caching', 'Load balancing', 'Sharding',
  'CAP theorem', 'Rate limiting',
];

export const FEATURES = [
  {
    icon: '📖',
    title: 'A real page-flip reader',
    body: 'Two-page spreads on desktop, a single crisp page on mobile. Curl, sound and night mode are built in — not a scroll-view faking it.',
    tag: 'Reader',
  },
  {
    icon: '🎯',
    title: 'Practice Mode after every read',
    body: 'Every book ships an MCQ bank. Answer, get instant reasoning, and watch your accuracy climb spread by spread.',
    tag: 'Practice',
  },
  {
    icon: '🔥',
    title: 'Streaks, points & badges',
    body: 'Daily streaks and points turn revision into a habit. Badges unlock as you clear sections — quietly, without nagging popups.',
    tag: 'Habit',
  },
  {
    icon: '🏆',
    title: 'Leaderboard',
    body: 'See where you stand against other readers this week. Friendly pressure beats another untouched study plan.',
    tag: 'Community',
  },
  {
    icon: '🔖',
    title: 'Bookmarks & contents drawer',
    body: 'Mark a key concept with ☆ from any page and jump straight back from the Contents drawer. Hotkeys included (←/→, j/k, f, t).',
    tag: 'Reader',
  },
  {
    icon: '🔍',
    title: 'Full-text search',
    body: 'Postgres full-text search across every spread you are entitled to — find “volatile” or “window function” in a keystroke.',
    tag: 'Search',
  },
  {
    icon: '🔐',
    title: 'Premium that stays premium',
    body: 'Paywalls are enforced by Postgres RLS *and* the API, so locked spreads never reach an unentitled browser. Pages carry your own watermark.',
    tag: 'Security',
  },
  {
    icon: '🧑‍💼',
    title: 'Publisher & admin tooling',
    body: 'Roles for reader / publisher / admin, a full admin dashboard with revenue + signup graphs, bulk import, and per-reader access grants.',
    tag: 'Platform',
  },
];

export const STEPS = [
  {
    n: '01',
    icon: '✍️',
    title: 'Create a free account',
    body: 'Email + password, no card, no trial timer. The Free Forever plan opens every free book immediately.',
  },
  {
    n: '02',
    icon: '📚',
    title: 'Pick a book and flip',
    body: 'Theory on the left page, dry-runs and drills on the right. Your reading position is saved the moment you turn.',
  },
  {
    n: '03',
    icon: '🎯',
    title: 'Drill what you just read',
    body: 'Practice Mode turns each spread into questions with reasoning, so a chapter ends as knowledge instead of a highlight.',
  },
  {
    n: '04',
    icon: '🚀',
    title: 'Track it and go again',
    body: 'Streaks, points, badges and the leaderboard keep the loop honest — then resume on any device exactly where you stopped.',
  },
];

/* Fallback copy for the pricing preview if /api/billing/plans is unreachable
 * (the live page always prefers the server's plans). */
export const PLANS_FALLBACK = [
  {
    plan_id: 'free',
    name: 'Free Forever',
    price_paise: 0,
    interval_days: 0,
    features: ['Browse catalog', 'Read every FREE book', 'Synced reading progress'],
  },
  {
    plan_id: 'premium_monthly',
    name: 'Premium Monthly',
    price_paise: 19900,
    interval_days: 30,
    features: ['All PREMIUM books unlocked', 'Full-text search', 'New releases first'],
  },
  {
    plan_id: 'premium_yearly',
    name: 'Premium Yearly',
    price_paise: 149900,
    interval_days: 365,
    features: ['Everything in Monthly', '2 months free'],
  },
];

export const FAQS = [
  {
    q: 'Do I need to pay to start?',
    a: 'No. The Free Forever plan needs no card and opens every free title — including the full Java 8 → 17 Essentials book and its practice bank. Upgrade only when you want the premium shelf.',
  },
  {
    q: 'What do the premium books include?',
    a: 'Each premium title is a full multi-section book with theory spreads, worked dry-runs and its own MCQ bank — Spring Boot, DSA, SQL and System Design. Premium Monthly is ₹199 and Premium Yearly is ₹1,499 (two months free).',
  },
  {
    q: 'Can I read on my phone?',
    a: 'Yes. The reader detects small screens and switches to a single-page mode with a mobile toolbar. Desktop keeps the two-page spread, hotkeys and the contents drawer.',
  },
  {
    q: 'Will it remember where I stopped?',
    a: 'Your flip position is written to your account as you read, so opening the same book on another device drops you on the same page — not back at the cover.',
  },
  {
    q: 'How does payment work?',
    a: 'Checkout runs through Razorpay’s hosted flow and the activation is verified with an HMAC-SHA256 signature check on the server (plus a signed webhook as a second path). In development the app runs a sandbox gateway that activates without charging.',
  },
  {
    q: 'Is the content protected?',
    a: 'Premium pages are gated in Postgres row-level security and again in the API, printing is disabled, and every rendered page carries a per-user watermark so a leak is traceable to the account that took it.',
  },
];
