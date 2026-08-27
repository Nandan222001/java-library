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
        └── pages/  Library · Reader · Pricing · Account · Login · Signup
```

## 1 · Database
Dashboard → SQL Editor → paste & RUN `supabase/schema.sql`.

## 2 · Server
```bash
cd server
cp .env.example .env          # paste SUPABASE_SERVICE_ROLE_KEY (Settings→API)
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
`sandbox` provider activates plans instantly for testing. To go live:
swap the mutation inside `routes/billing.js POST /checkout` for a Stripe
Checkout Session, and let the payment webhook write the same
`subscriptions` row — zero downstream changes needed.

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
| `CLIENT_ORIGIN` | your deployed web origin, e.g. `https://your-web-app.vercel.app` |
| `ADMIN_IMPORT_SECRET` | a long random string (ops import endpoint) |
| `BILLING_PROVIDER` | `sandbox` (or switch to Stripe/Razorpay later) |

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

