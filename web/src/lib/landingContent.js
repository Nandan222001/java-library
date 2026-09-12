/* Landing-page content for the "Digital Library" marketing page.
 * All imagery lives in web/public/landing/ and was generated for this project. */

export const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Books', hash: '#library' },
  { label: 'Features', hash: '#features' },
  { label: 'Pricing', hash: '#pricing' },
  { label: 'Practice', to: '/practice' },
  { label: 'Leaderboard', to: '/leaderboard' },
];

/* ---------- top hero carousel slides ---------- */
export const SLIDES = [
  {
    badge: 'YOUR TECH CAREER STARTS HERE',
    h1: 'Learn Today.',
    h2: 'Build Tomorrow.',
    lead:
      'The ultimate digital library for technical and career preparation. Expert-curated books, interactive MCQs, progress tracking, and a gamified learning experience — all in one place.',
    img: '/landing/hero-laptop.jpg',
    alt: 'Laptop showing the Digital Library reader with tech books beside it',
    primary: 'Explore Books',
    secondary: 'Watch Demo',
  },
  {
    badge: 'FEATURED BOOK',
    h1: 'System Design.',
    h2: 'Scale With Confidence.',
    lead:
      'Learn how to design and scale modern systems used by products like Netflix, Amazon and Google. Real-world examples, diagrams, and interview-focused content.',
    img: '/landing/featured-video.jpg',
    alt: 'System Design video course player with a load balancer diagram',
    primary: 'Watch Full Preview',
    secondary: 'View Chapters',
  },
  {
    badge: 'INTERACTIVE LEARNING',
    h1: 'Read. Practice.',
    h2: 'Master With MCQs.',
    lead:
      'Each chapter comes with MCQs, quizzes and progress tracking to help you stay on track and measure your growth — chapter after chapter, book after book.',
    img: '/landing/mcq-laptop-light.jpg',
    alt: 'Laptop showing an interactive MCQ quiz with progress panel',
    primary: 'Try a Quiz',
    secondary: 'See How It Works',
  },
];

export const HERO_STATS = [
  { icon: '📚', value: '15', label: 'Books' },
  { icon: '📑', value: '435', label: 'Chapters' },
  { icon: '📄', value: '750', label: 'Spreads' },
  { icon: '🎯', value: '100%', label: 'Career Focused' },
];

/* ---------- why choose ---------- */
export const FEATURES = [
  {
    icon: '📘',
    tint: '#2563eb',
    title: 'Expert-Curated Content',
    body: 'Real industry experts covering real-world concepts and interview preparation.',
  },
  {
    icon: '⚡',
    tint: '#7c3aed',
    title: 'Interactive MCQs',
    body: 'Test your knowledge and track your progress.',
  },
  {
    icon: '🏆',
    tint: '#16a34a',
    title: 'Gamification',
    body: 'Earn points, maintain streaks, climb the leaderboard.',
  },
  {
    icon: '🔒',
    tint: '#ea580c',
    title: 'Secure & Private',
    body: 'Watermarked pages, anti-copy protection, and more.',
  },
  {
    icon: '📱',
    tint: '#0d9488',
    title: 'Access Anywhere',
    body: 'Read on web, tablet, or mobile. Your library, always with you.',
  },
  {
    icon: '🛡️',
    tint: '#e11d48',
    title: 'Content Protection',
    body: 'Right-click, selection, and print disabled with per-user watermark.',
  },
];

/* ---------- library shelf ---------- */
export const BOOKS = [
  { title: 'DSA', cover: '/landing/cover-dsa.jpg', chapters: 29 },
  { title: 'System Design', cover: '/landing/cover-system.jpg', chapters: 29 },
  { title: 'Spring Boot', cover: '/landing/cover-spring.jpg', chapters: 29 },
  { title: 'Java 8 – 17', cover: '/landing/cover-java.jpg', chapters: 29 },
  { title: 'MySQL', cover: '/landing/cover-sql.jpg', chapters: 28 },
  { title: 'Python', cover: '/landing/cover-python.jpg', chapters: 29 },
  { title: 'C', cover: '/landing/cover-c.jpg', chapters: 28 },
  { title: 'C++', cover: '/landing/cover-cpp.jpg', chapters: 29 },
  { title: 'JavaScript/TypeScript', cover: '/landing/cover-jsts.jpg', chapters: 29 },
  { title: 'Docker/Kubernetes', cover: '/landing/cover-docker.jpg', chapters: 29 },
  { title: 'Git & Version Control', cover: '/landing/cover-git.jpg', chapters: 29 },
  { title: 'Ethical Hacking & Cybersecurity', cover: '/landing/cover-hacking.jpg', chapters: 29 },
  { title: 'The Habit Gap', cover: '/landing/cover-habit.jpg', chapters: 29 },
];

export const SPREADS_PER_BOOK = 50;

/* ---------- featured book ---------- */
export const FEATURED = {
  title: 'System Design',
  tagline: 'Design Scalable Systems',
  body:
    'Learn how to design and scale modern systems used by products like Netflix, Amazon and Google. Real-world examples, diagrams, and interview-focused content.',
  points: [
    'Scalable architecture patterns',
    'Load balancing & caching',
    'Database design & sharding',
    'Real-world case studies',
  ],
  img: '/landing/featured-video.jpg',
};

/* ---------- practice / MCQ sections ---------- */
export const PRACTICE_POINTS = [
  {
    icon: '❓',
    tint: '#2563eb',
    title: 'Chapter-wise MCQs',
    body: 'Test your understanding with chapter-based questions.',
  },
  {
    icon: '📊',
    tint: '#7c3aed',
    title: 'Track Progress',
    body: 'See your learning journey in real time.',
  },
  {
    icon: '🎯',
    tint: '#e11d48',
    title: 'Earn Points & Streaks',
    body: 'Stay motivated with gamification.',
  },
  {
    icon: '🏅',
    tint: '#d97708',
    title: 'Climb the Leaderboard',
    body: 'Compete and be the best.',
  },
];

/* ---------- video tour ---------- */
export const VIDEOS = [
  { title: '1. Platform Overview', time: '2:45', thumb: '/landing/video-thumb-1.jpg' },
  { title: '2. Reader & Flipbook Engine', time: '3:12', thumb: '/landing/video-thumb-2.jpg' },
  { title: '3. MCQs & Gamification', time: '2:38', thumb: '/landing/video-thumb-3.jpg' },
];

/* ---------- testimonials ---------- */
export const TESTIMONIALS = [
  {
    name: 'Rahul Sharma',
    role: 'Software Engineer',
    avatar: '/landing/avatar-1.jpg',
    quote:
      'The content is top-notch and the platform is smooth. The MCQs after each chapter make revision actually stick.',
  },
  {
    name: 'Priya Verma',
    role: 'Full Stack Developer',
    avatar: '/landing/avatar-2.jpg',
    quote:
      "I love the flip-book reader! It feels so smooth and natural. And the reading platform? It's easy to use for hours.",
  },
  {
    name: 'Adit Kumar',
    role: 'System Design Enthusiast',
    avatar: '/landing/avatar-3.jpg',
    quote:
      'The system design section is incredible. Clear explanations with real-world examples and diagrams that finally click.',
  },
  {
    name: 'Sneha Patel',
    role: 'Placed at TCS',
    avatar: '/landing/avatar-4.jpg',
    quote:
      'Helped me prepare for interviews and also improved my problem-solving skills. Highly recommended!',
  },
];

/* ---------- pricing ---------- */
export const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: '',
    badge: null,
    cta: 'Start Free',
    features: ['1 book free access', 'Read in web reader', 'Progress tracking'],
  },
  {
    name: 'Pro',
    price: '₹199',
    period: '/ month',
    badge: 'Most Popular',
    cta: 'Get Pro',
    features: [
      'Access to all 15 books',
      'Advanced MCQs & gamification',
      'Full leaderboard access',
      'Priority support',
    ],
  },
  {
    name: 'Lifetime',
    price: '₹1,999',
    period: '/ one-time',
    badge: 'Best Value',
    cta: 'Buy Lifetime',
    features: [
      'Lifetime access to all content',
      'All features included',
      'Future books free',
      'Priority support',
    ],
  },
];

export const PRICING_ASSURANCES = [
  { icon: '🔒', title: 'Secure Payments', body: 'Razorpay, UPI & cards supported' },
  { icon: '⚡', title: 'Instant Access', body: 'Start learning immediately' },
  { icon: '↩️', title: 'Cancel Anytime', body: 'No questions asked' },
];

export const FOOTER_LINKS = ['Home', 'Books', 'Features', 'Pricing', 'Practice', 'Leaderboard', 'Contact'];
