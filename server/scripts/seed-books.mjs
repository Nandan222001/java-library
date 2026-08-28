/* ============================================================
 * seed-books.mjs — import a starter catalog of EXTRA books so the
 * library isn't a single-title app. Each book gets real spread
 * content + a small MCQ practice bank, POSTed through the same
 * admin endpoints the CLI import uses (full-replace per slug,
 * safe to re-run).
 *
 *   cd server
 *   node scripts/seed-books.mjs \
 *        --api http://localhost:8080 \
 *        --secret $ADMIN_IMPORT_SECRET \
 *        [--no-publish]
 * ============================================================ */
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

const API = (arg('--api') || 'http://localhost:8080').replace(/\/+$/, '');
const SECRET = arg('--secret') || process.env.ADMIN_IMPORT_SECRET;
const PUBLISH = !argv.includes('--no-publish');

if (!SECRET) {
  console.error('Missing secret: pass --secret <ADMIN_IMPORT_SECRET>');
  process.exit(1);
}

/* A spread = one page-flip: theory on the left, worked example on the right. */
const SP = (kicker, head, theory, example) => ({
  l_kicker: kicker, l_head: head, l_html: `<p>${theory}</p>`,
  r_kicker: kicker, r_head: 'Worked example', r_html: example || '<p>—</p>'
});

const BOOKS = [];

BOOKS.push({
  meta: {
    slug: 'java-8-to-17', title: 'Java 8 → 17 Essentials',
    subtitle: 'Modern language features every interviewer expects',
    author: 'Java Library Team', cover_emoji: '🚀', tier: 'free'
  },
  parts: [
    { part_id: 'fp', label: 'Functional style', color: '#4f9cf7' },
    { part_id: 'modern', label: 'Modern Java', color: '#c9a227' }
  ],
  spreads: [
    SP('fp', 'Lambda expressions',
      'A lambda is a compact anonymous function: (args) -> body. It passes behaviour to methods instead of verbose anonymous classes.',
      '<pre>List&lt;String&gt; names = ...;\nnames.sort((a, b) -> a.length() - b.length());</pre>'),
    SP('fp', 'Streams pipeline',
      'Streams process collections declaratively: source → intermediate ops → one terminal op. Intermediate ops are lazy.',
      '<pre>int total = orders.stream()\n    .filter(o -&gt; o.state().equals("PAID"))\n    .mapToInt(Order::amount)\n    .sum();</pre>'),
    SP('fp', 'Optional<T>',
      'Optional models values that may be absent, forcing callers to handle the empty case instead of tripping on null.',
      '<pre>String email = user.flatMap(User::profile)\n    .map(Profile::email)\n    .orElse("no-email");</pre>'),
    SP('modern', 'Records',
      'Records are transparent data carriers: the compiler writes equals/hashCode/toString and accessors from the header alone.',
      '<pre>record Point(int x, int y) {}\nvar p = new Point(3, 4);\np.x(); // 3</pre>'),
    SP('modern', 'Sealed classes',
      'Sealed classes restrict who may extend them — the subtype set is known to the compiler, enabling exhaustive switches.',
      '<pre>sealed interface Shape\n    permits Circle, Square, Dot {}\nrecord Circle(double r) implements Shape {}\nrecord Square(double s) implements Shape {}</pre>'),
    SP('modern', 'Pattern matching for switch',
      'Switch now pattern-matches types and guards, replacing long instanceof chains without cast noise.',
      '<pre>String s = switch (shape) {\n    case Circle c -&gt; "r=" + c.r();\n    case Square sq -&gt; "s=" + sq.s();\n    default -&gt; "other";\n};</pre>')
  ],
  questions: [
    { question: 'Which interface makes a stream pipeline execute?', options: ['Intermediate operation', 'Terminal operation', 'The source', 'A parallel hint'], correct_index: 1, difficulty: 'easy',
      explanation: 'Intermediate ops are lazy; a terminal op like collect() or sum() triggers evaluation.' },
    { question: 'What does Optional.flatMap avoid compared to map?', options: ['Nested optionals', 'Compile-time null checks', 'Lambda syntax', 'Checked exceptions'], correct_index: 0, difficulty: 'medium',
      explanation: 'flatMap unwraps a function that itself returns an Optional, so the result is not Optional<Optional<T>>.' },
    { question: 'Which feature was finalised in Java 17?', options: ['Generics', 'Sealed classes', 'Checked exceptions', 'Applets'], correct_index: 1, difficulty: 'easy',
      explanation: 'Sealed classes shipped as a final feature in Java 17.' }
  ]
});

BOOKS.push({
  meta: {
    slug: 'spring-boot-practice', title: 'Spring Boot in Practice',
    subtitle: 'Build real REST services with Spring Boot, end to end',
    author: 'Java Library Team', cover_emoji: '🍃', tier: 'premium'
  },
  parts: [
    { part_id: 'core', label: 'Boot core', color: '#43a047' },
    { part_id: 'data', label: 'Data & APIs', color: '#c9a227' }
  ],
  spreads: [
    SP('core', 'Dependency injection',
      'Spring manages beans and injects dependencies via constructors. Constructor injection is recommended: fields stay final and the object is always fully built.',
      '<pre>@Service\nclass CartService {\n  private final ProductRepo repo;\n  CartService(ProductRepo repo) { this.repo = repo; }\n}</pre>'),
    SP('core', 'Auto-configuration',
      'Auto-configuration picks sensible defaults from libraries on the classpath; @SpringBootApplication enables it plus component scanning.',
      '<pre>@SpringBootApplication\npublic class App {\n  public static void main(String[] a) {\n    SpringApplication.run(App.class, a);\n  }\n}</pre>'),
    SP('core', 'The application context',
      'The ApplicationContext is an object graph of beans. Profiles and @ConditionalOnProperty swap configuration per environment.',
      '<pre>@Bean\n@Profile("test")\nDataSource ds() { return new HikariDataSource(testCfg); }</pre>'),
    SP('data', 'REST controllers',
      '@RestController combines @Controller and @ResponseBody, mapping HTTP verbs to methods whose return values serialise to JSON.',
      '<pre>@RestController\n@RequestMapping("/api/books")\nclass BooksController {\n  @GetMapping("/{id}")\n  Book one(@PathVariable Long id) { return service.get(id); }\n}</pre>'),
    SP('data', 'Spring Data repositories',
      'Repository interfaces get runtime implementations: derived query methods like findByTitleIgnoreCase need no SQL at all.',
      '<pre>interface BookRepo extends JpaRepository&lt;Book, Long&gt; {\n  List&lt;Book&gt; findByAuthor(String author);\n}</pre>'),
    SP('data', 'Validation & error handling',
      'JSR-380 annotations on DTOs plus a @RestControllerAdvice centralise validation errors into clean HTTP 400 responses.',
      '<pre>@ExceptionHandler(MethodArgumentNotValidException.class)\nResponseEntity&lt;?&gt; bad(MethodArgumentNotValidException ex) {\n  var msg = ex.getBindingResult().getAllErrors()\n      .stream().map(e -&gt; e.getDefaultMessage()).toList();\n  return ResponseEntity.badRequest().body(msg);\n}</pre>')
  ],
  questions: [
    { question: 'Which annotation combines @Controller with @ResponseBody?', options: ['@Component', '@RestController', '@Service', '@SpringBootApplication'], correct_index: 1, difficulty: 'easy',
      explanation: '@RestController is a stereotype made of @Controller + @ResponseBody.' },
    { question: 'What does Spring Data derive at runtime?', options: ['Controller endpoints', 'Repository implementations from method names', 'Bean names', 'A database schema'], correct_index: 1, difficulty: 'medium',
      explanation: 'Derived query methods parse method names to build queries at startup.' },
    { question: 'Where should cross-cutting validation errors be handled?', options: ['In every controller', 'A @RestControllerAdvice', 'In the repository', 'In SQL'], correct_index: 1, difficulty: 'medium',
      explanation: 'One advice class translates validation errors consistently and avoids duplicated controller code.' }
  ]
});

BOOKS.push({
  meta: {
    slug: 'dsa-crash-course', title: 'Data Structures & Algorithms',
    subtitle: 'The patterns that keep showing up in coding interviews',
    author: 'Java Library Team', cover_emoji: '🧠', tier: 'premium'
  },
  parts: [
    { part_id: 'ds', label: 'Data structures', color: '#4f9cf7' },
    { part_id: 'algo', label: 'Algorithms', color: '#c9a227' }
  ],
  spreads: [
    SP('ds', 'Big O — the language of interviewers',
      'Big O describes how time/space scale with input size. Recognising the O of common shapes (loops, nested loops, recursion) is the first step of every solution.',
      '<pre>O(1)      constant\nO(log n)  binary search\nO(n)      single pass\nO(n log n) sorting\nO(n^2)    nested loop</pre>'),
    SP('ds', 'Hash maps — O(1) lookups',
      'Hash maps turn "did I see this before?" questions from O(n²) into O(n): store what you have seen and check later elements against it.',
      '<pre>// Two-sum in one pass\nMap&lt;Integer,Integer&gt; seen = new HashMap&lt;&gt;();\nfor (int i = 0; i &lt; a.length; i++) {\n  if (seen.containsKey(target - a[i])) return ...;\n  seen.put(a[i], i);\n}</pre>'),
    SP('ds', 'Two pointers',
      'On sorted arrays a left and right pointer can meet in the middle, collapsing nested loops into a single linear scan.',
      '<pre>int l = 0, r = a.length - 1;\nwhile (l &lt; r) {\n  int s = a[l] + a[r];\n  if (s == t) return true;\n  if (s &lt; t) l++; else r--;\n}</pre>'),
    SP('ds', 'The sliding window',
      'For contiguous subarray problems a window slides across the array; each step adds one element and drops one — often O(n).',
      '<pre>int best = 0, sum = 0;\nfor (int r = 0; r &lt; n; r++) {\n  sum += a[r];\n  while (sum &gt; k) sum -= a[l++];\n  best = Math.max(best, r - l + 1);\n}</pre>'),
    SP('algo', 'Binary search',
      'Binary search splits a sorted search space in half each step. Choose the invariant carefully — it applies to more than sorted arrays.',
      '<pre>int lo = 0, hi = n - 1;\nwhile (lo &lt; hi) {\n  int mid = lo + (hi - lo) / 2;\n  if (ok(mid)) hi = mid; else lo = mid + 1;\n}\nreturn lo;</pre>'),
    SP('algo', 'Recursion → memoization → DP',
      'Most DP is recursion plus a cache. Write the brute force first, add a memo table keyed by the recursive call arguments, then optimise.',
      '<pre>int fib(int n, int[] memo) {\n  if (n &lt; 2) return n;\n  if (memo[n] != 0) return memo[n];\n  return memo[n] = fib(n-1, memo) + fib(n-2, memo);\n}</pre>')
  ],
  questions: [
    { question: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], correct_index: 1, difficulty: 'easy',
      explanation: 'Each comparison halves the search space, giving logarithmic time.' },
    { question: 'Which pattern fixes most "find a pair" problems in O(n)?', options: ['Grid traversal', 'Hash map of seen values', 'Bubble sort', 'Recursion with no base case'], correct_index: 1, difficulty: 'medium',
      explanation: 'Storing previously seen elements in a hash map avoids the nested loop.' },
    { question: 'Sliding window is best suited for…', options: ['Contiguous subarray problems', 'Graph shortest paths', 'Palindromic strings', 'Sorting an array'], correct_index: 0, difficulty: 'medium',
      explanation: 'The window scans contiguous ranges while keeping one pointer for the start.' }
  ]
});

BOOKS.push({
  meta: {
    slug: 'sql-for-interviews', title: 'SQL for Interviews',
    subtitle: 'Joins, aggregations and window functions, explained on real schemas',
    author: 'Java Library Team', cover_emoji: '🗄️', tier: 'premium'
  },
  parts: [
    { part_id: 'basics', label: 'Query basics', color: '#43a047' },
    { part_id: 'windows', label: 'Analytics', color: '#c9a227' }
  ],
  spreads: [
    SP('basics', 'SELECT runs in a fixed order',
      'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT. Aliases in SELECT are unavailable to WHERE because WHERE runs first.',
      '<pre>SELECT dept, count(*) AS n\nFROM   employees\nWHERE  salary &gt; 40000\nGROUP  BY dept\nHAVING count(*) &gt;= 2\nORDER  BY n DESC;</pre>'),
    SP('basics', 'JOIN types',
      'INNER JOIN keeps only matches; LEFT JOIN keeps every left row, filling NULLs on the right; FULL OUTER JOIN keeps everything on both sides.',
      '<pre>SELECT e.name, o.amount\nFROM   employees e\nLEFT   JOIN orders o ON o.emp_id = e.id;</pre>'),
    SP('basics', 'GROUP BY aggregation',
      'GROUP BY collapses rows by key and lets aggregate functions (sum/avg/max/min/count) compute per group. Non-aggregated columns must be in the GROUP BY.',
      '<pre>SELECT customer_id, sum(amount) AS lifetime\nFROM   orders\nGROUP  BY customer_id;</pre>'),
    SP('basics', 'HAVING vs WHERE',
      'WHERE filters rows before grouping; HAVING filters groups after aggregation — embrace the ordering or your conditions silently misbehave.',
      '<pre>SELECT year, avg(score)\nFROM   results\nWHERE  league = \'PL\'      -- row filter\nGROUP  BY year\nHAVING avg(score) &gt; 70;  -- group filter</pre>'),
    SP('windows', 'Window functions — ranked over a partition',
      'RANK() OVER (PARTITION BY … ORDER BY …) numbers rows inside each partition, ideal for "top N per group" questions.',
      '<pre>SELECT name, dept, salary,\n       rank() OVER (\n         PARTITION BY dept ORDER BY salary DESC) rnk\nFROM   employees;</pre>'),
    SP('windows', 'Running totals & moving averages',
      'OVER with ORDER BY turns a frame into a cumulative sum; adding ROWS BETWEEN frames window it for moving averages.',
      '<pre>SELECT date, revenue,\n       sum(revenue) OVER (ORDER BY date\n           ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma7\nFROM   daily_sales;</pre>')
  ],
  questions: [
    { question: 'Which clause filters groups after aggregation?', options: ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'], correct_index: 1, difficulty: 'easy',
      explanation: 'HAVING runs after GROUP BY and filters aggregated groups.' },
    { question: 'A LEFT JOIN keeps…', options: ['Only matched rows', 'All left rows, NULLs where unmatched', 'All rows from both sides', 'Only right rows'], correct_index: 1, difficulty: 'easy',
      explanation: 'Every left row survives; unmatched right columns are NULL.' },
    { question: 'Which function returns rankings with gaps?', options: ['DENSE_RANK', 'RANK', 'ROW_NUMBER', 'LAG'], correct_index: 1, difficulty: 'medium',
      explanation: 'RANK leaves gaps after ties (1,2,2,4); DENSE_RANK does not (1,2,2,3).' }
  ]
});

BOOKS.push({
  meta: {
    slug: 'system-design-basics', title: 'System Design Basics',
    subtitle: 'A hands-on primer for the design interview',
    author: 'Java Library Team', cover_emoji: '🏗️', tier: 'premium'
  },
  parts: [
    { part_id: 'foundations', label: 'Foundations', color: '#4f9cf7' },
    { part_id: 'building', label: 'Building blocks', color: '#c9a227' }
  ],
  spreads: [
    SP('foundations', 'Estimates before architecture',
      'Start with numbers: QPS, storage, bandwidth. "100M users, 10% daily active, each 20 reads" gives back-of-envelope targets that drive every later choice.',
      '<pre>100M users\nDAU  ~= 10M\nreads ~= 10M * 20 / day ≈ 2,300 reads/s\nstorage growth = 10M * 1KB * 365 ≈ 3.6 TB/yr</pre>'),
    SP('foundations', 'Load balancers & scaling',
      'Scale out horizontally behind a load balancer; keep servers stateless so any of them can serve any request.',
      '<pre>Client → LB → App1, App2, App3\n                     ↓ shared\n                 Postgres + Redis</pre>'),
    SP('foundations', 'Caching strategies',
      'Cache-aside is the default: read from cache, miss → read DB → write cache. Beware of thundering herds on cold caches and keep TTLs sane.',
      '<pre>get(key):\n  if cache.has(key): return cache.get(key)\n  val = db.find(key)\n  cache.set(key, val, ttl=300)\n  return val</pre>'),
    SP('building', 'Databases — SQL vs NoSQL',
      'OLTP rows go in Postgres; event streams, feeds and analytics heavier writes may suit NoSQL. Most design answers keep a relational DB plus one cache.',
      '<pre>Relational        | cache / kv | search\nusers, orders    | Redis/sessions | Elasticsearch\ncounters, rate limits | etc.</pre>'),
    SP('building', 'APIs, rate limiting & idempotency',
      'Rate-limit per user with a sliding window in Redis; accept idempotency keys so retries from flaky clients never double-charge or duplicate.',
      '<pre>POST /orders\nIdempotency-Key: 9f2c…\n→ order created once, retries return same order.</pre>'),
    SP('building', 'Async with queues',
      'Push slow work (email, thumbnails, order confirmations) onto a queue so the API returns fast and workers scale independently.',
      '<pre>API → Queue (Redis/Kafka) → Workers → Email/SMS</pre>')
  ],
  questions: [
    { question: 'What should you calculate BEFORE choosing a database?', options: ['The company logo', 'QPS, storage and bandwidth estimates', 'The readme length', 'The interview room size'], correct_index: 1, difficulty: 'easy',
      explanation: 'Back-of-envelope numbers make architecture decisions concrete.' },
    { question: 'Which strategy is considered the default for caching?', options: ['Write-through only', 'Cache-aside', 'No cache at all', 'Read-replica cache'], correct_index: 1, difficulty: 'medium',
      explanation: 'Cache-aside (lazy load) is the simplest and most common default.' },
    { question: 'Why add an idempotency key to payment APIs?', options: ['To make endpoints slower', 'So retries never double-charge', 'To hide the database', 'To avoid TLS'], correct_index: 1, difficulty: 'medium',
      explanation: 'Retries with the same key resolve to the original result instead of creating duplicates.' }
  ]
});

/* ============================================================
 * Import every book through the same admin endpoints.
 * ============================================================ */
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': SECRET },
    body: JSON.stringify(body)
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}

let ok = 0, fail = 0;
for (const b of BOOKS) {
  const { meta, parts, spreads, questions } = b;
  try {
    const chapters = spreads.map((s, i) => ({
      num: i + 1,
      part_id: parts.length ? parts[i % parts.length].part_id : 'main',
      title: s.l_head || `Section ${i + 1}`,
      idx: i
    }));
    const out = await post('/api/admin/import', {
      book: { ...meta, published: PUBLISH },
      parts: parts.map((p, ord) => ({ ...p, ord })),
      chapters,
      spreads: spreads.map((s, i) => ({ idx: i, ...s }))
    });
    let q = 0;
    if (questions && questions.length) {
      const qout = await post(`/api/admin/books/${meta.slug}/practice/import`, { questions });
      q = qout.count || 0;
    }
    console.log(`✅ ${meta.slug.padEnd(24)} ${out.counts.spreads.toString().padStart(3)} spreads · ${String(q).padStart(2)} questions · ${out.tier} · ${out.published ? 'published' : 'draft'}`);
    ok++;
  } catch (err) {
    fail++;
    console.error(`❌ ${meta.slug}: ${err.message}`);
  }
}
console.log(`\nDone — ${ok} imported, ${fail} failed.`);
if (PUBLISH && ok)
  console.log('Publishing enabled: all books are live in the library now. 🎉');
else if (ok)
  console.log('Run with --publish (default) to show them in the library.');