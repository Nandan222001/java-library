# ☕ Java Library — React · Node · Supabase digital-books platform

Your **400-question interview book** reborn as a full digital-books library:
email/password auth, roles (`reader / publisher / admin`), free-vs-premium
entitlements enforced by Postgres RLS *and* the API, sandbox subscription
billing with a clean Stripe/Razorpay seam, cross-device reading progress,
and the original page-flip reader untouched as a React-mounted island.

```
java-library/
├── supabase/schema.sql        ← run once in SQL Editor (auth trigger · RLS · search RPC)
├── server/                    ← Express API
│   ├── src/index.js           ← helmet·cors·json(12mb)·routes
│   ├── src/lib/supabase.js    ← service client + per-request user-bound client
│   ├── src/middleware/auth.js ← JWT gate (+60s cache) → req.user/profile/sb
│   ├── src/middleware/rbac.js ← role gate · entitlements() · bookEntitlement()
│   ├── src/routes/me.js       ← GET/PATCH profile
│   ├── src/routes/library.js  ← catalog · meta · spreads(paywalled) · FTS search · progress
│   ├── src/routes/billing.js  ← plans · sandbox checkout · cancel
│   ├── src/routes/admin.js    ← bulk import (secret or admin JWT) · publish flips
│   └── scripts/import-book.mjs← uploads your existing java-book content
└── web/                       ← React 18 + Vite
    ├── public/engine/         ← unmodified flip-book engine (js+css) as static assets
    └── src/
        ├── context/AuthContext.jsx   ← session · role/plan state · JWT bridge
        ├── lib/engineLoader.js       ← mounts engine into #host via BOOK_SRC→Node API
        └── pages/  Dashboard · Library · Reader · Pricing · Account · Login · Signup · Admin
```

## 1 · Database
Dashboard → SQL Editor → paste & RUN `supabase/schema.sql`, then run the
migrations in order: `supabase/migrations/002_pricing_mcq_gamification.sql`,
`003_smtp_settings.sql`, and `004_dashboard_grants_payments.sql`
(dashboards · read-permission grants · payments ledger for sales graphs).

## 2 · Server
```bash
cd server
cp .env.example .env          # paste SUPABASE_SERVICE_ROLE_KEY + SUPABASE_PUBLISHABLE_KEY (Settings→API)
npm install
npm run dev                   # → http://localhost:8080
```

## 3 · Import your book
```bash
# from java-library/server — one-time 'pg'-free REST flow through the API:
node scripts/import-book.mjs \
     --content ../../java-book \
     --api http://localhost:8080 \
     --secret change-me-long-random-string \
     --tier premium --publish
```

## 4 · Frontend
```bash
cd web
npm install
npm run dev                   # → http://localhost:5173  ('/api' proxied to :8080)
```
`.env` ships prefilled with the project URL + publishable key you provided.
Sign up → then (optional admin):
```sql
update public.profiles set role='admin'
 where email='your@email.com';
```

## 🔐 Security model
| Layer | Mechanism |
|---|---|
| Browser | publishable key only · never stores premium HTML unless entitled |
| Node API | JWT verify → role gates → explicit paywall before premium payloads |
| Supabase | RLS everywhere; `has_book_access()` definer fn reads subscriptions; subscriptions table is **read-only for users** |
| Writes | profiles/name & progress via user-token client (RLS-checked); billing/import exclusively via service-role on trusted routes |

## 💳 Payments
Everything bills against one table, `subscriptions` and `book_purchases`,
so entitlement logic never changes with the gateway.

- **Sandbox (default)** — `POST /api/billing/checkout` and
  `POST /api/billing/purchase/:slug` activate instantly, charging nothing.
- **Razorpay (live)** — set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`;
  the UI now does `POST /api/billing/order` → hosted Razorpay checkout →
  `POST /api/billing/verify` (HMAC-SHA256 signature check, then activation).
  A signed webhook (`POST /api/billing/razorpay/webhook`) is the second,
  independent activation path — both are idempotent and safe to race.
  Webhook URL: `https://your-api/…/api/billing/razorpay/webhook` (event:
  `payment.captured`).

Every captured subscription / purchase / admin grant is recorded in the
`payments` ledger — that's what the admin sales graphs read from (works in
sandbox mode too).

## 🧭 Dashboards
- **`/dashboard` (any signed-in user)** — role-aware overview: books,
  points/streaks/badges, continue-reading cards, role permissions, and
  role-appropriate shortcuts (admin gets a one-click gate to the admin panel).
- **`/admin` (admins only)** — the full admin dashboard: **Dashboard** tab
  with revenue + signups graphs (14 days), top books, recent transactions,
  plus Books (incl. **✨ Add a book**), Plans, Users, **Grants** and Email.

## 🔓 Read-permission grants
Admins can give any reader access to a specific book — no subscription or
payment required — via **Admin → Users** (per-user picker) or **Admin →
Grants**. Backed by the `book_grants` table and enforced in **both** Postgres
RLS (`has_book_access()`) and the Node API (`bookEntitlement()`), so a revoked
grant is a revoke everywhere.

## 📚 More books
`server/scripts/seed-books.mjs` imports five ready-made interview-prep books
(Java 8→17, Spring Boot, DSA, SQL, System Design) each with spread content and
a practice-question bank — full-replace per slug, safe to re-run:

```bash
cd server
node scripts/seed-books.mjs --api http://localhost:8080 --secret $ADMIN_IMPORT_SECRET
```

You can also create an empty book shell from **Admin → Books → ✨ Add a new
book**, then fill its content with the import script or the API.

## 📱 Reader parity kept
Mobile single-page mode, transform-scale fix, hotkeys, TOC drawer,
bookmarks, night mode, sounds — all carried over verbatim inside
`web/public/engine/*`.

## ☁️ Deploy to Vercel

The repo is a monorepo; create **two Vercel projects**, both pointing at this repo
(with different Root Directories).

### Project 1 — API (Node serverless)
- **Root Directory:** `server`
- **Framework Preset:** Other (auto — `api/index.js` becomes a serverless function)
- Environment variables (Settings → Environment Variables, add to Production & Preview):

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://xddhhybyviuntnnymfbo.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your **service-role** key (Settings → API) |
| `SUPABASE_PUBLISHABLE_KEY` | same **publishable** key as `web`'s `VITE_SUPABASE_PUBLISHABLE_KEY` — needed as the `apikey` header for the per-request user-token client (progress sync, profile rename) |
| `CLIENT_ORIGIN` | your deployed web origin, e.g. `https://your-web-app.vercel.app` |
| `ADMIN_IMPORT_SECRET` | a long random string (ops import endpoint) |
| `BILLING_PROVIDER` | `sandbox` (or switch to Razorpay later) |
| `RAZORPAY_KEY_ID` | optional — set both Razorpay keys to go live |
| `RAZORPAY_KEY_SECRET` | optional — set both Razorpay keys to go live |

The Express app is exported at `server/api/index.js` — no `app.listen()` on Vercel;
local `npm run dev` still binds the port via `src/index.js`.

### Project 2 — Web (React + Vite SPA)
- **Root Directory:** `web`
- **Framework Preset:** Vite
- **Build Command:** `npm run build` (default) · **Output:** `dist`
- Environment variable: `VITE_API_URL=https://your-api-app.vercel.app` (the Project 1 domain)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` ship in `web/.env` (public-safe).
- `web/vercel.json` rewrites all front-end routes to `index.html` (SPA fallback);
  static `/engine/*` and `/assets/*` are served normally.

### After both deploy
1. Run `supabase/schema.sql` once in the Supabase SQL Editor.
2. Import your 400-question book against the **deployed API**:
   ```bash
   cd server
   node scripts/import-book.mjs \
        --content ../../java-book \
        --api https://your-api-app.vercel.app \
        --secret <your ADMIN_IMPORT_SECRET> \
        --tier premium --publish
   ```
3. Sanity-check `https://your-api-app.vercel.app/api/health` → `{ ok: true }`.

