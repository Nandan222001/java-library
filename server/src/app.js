import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import meRoutes from './routes/me.js';
import libraryRoutes from './routes/library.js';
import billingRoutes, { webhookHandler } from './routes/billing.js';
import adminRoutes from './routes/admin.js';
import practiceRoutes from './routes/practice.js';
import gamificationRoutes from './routes/gamification.js';

/** Build the Express app WITHOUT binding a port. Exporting `app` lets Vercel
 *  wrap it as a serverless function while `index.js` (local dev) calls listen. */
export async function buildApp() {
  const app = express();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
      root: path.join(process.cwd(), 'web')
    });
    app.use(vite.middlewares);
  }

  app.use(helmet({
    contentSecurityPolicy: false
  }));
  app.use(cors({
    origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
      .split(',').map(s => s.trim()),
    credentials: false
  }));
  /* Razorpay webhook verifies the signature over the RAW bytes of the body.
   * It MUST run before the global express.json() parser — otherwise req.body
   * arrives as a parsed object and the exact signed bytes are unrecoverable. */
  app.post('/api/billing/razorpay/webhook',
    express.raw({ type: '*/*', limit: '1mb' }),
    webhookHandler);

  app.use(express.json({ limit: '12mb' }));   // admin import payloads are big

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  /* Connection test — exercises the service key + a REAL tables query so a
   * deploy is self-verifying: proves env vars are set AND the DB/schema exist. */
  app.get('/api/dbcheck', async (_req, res) => {
    try {
      const { admin } = await import('./lib/supabase.js');
      const { error } = await admin.from('books').select('id').limit(1);
      res.json({
        ok: !error,
        service_key_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        query_error: error?.message || null,
        note: error ? 'DB read failed — check key + schema.sql applied' : 'DB reachable via service key'
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.use('/api', meRoutes);
  app.use('/api/books', libraryRoutes);
  app.use('/api/books', practiceRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/gamification', gamificationRoutes);

  if (process.env.NODE_ENV === 'production') {
    // Serve static files from the web build
    const distPath = path.join(process.cwd(), 'web/dist');
    app.use(express.static(distPath));

    // SPA fallback
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[API ERROR]', err.message);
    res.status(err.status || 500)
       .json({ error: err.expose ? err.message : 'Internal error' });
  });

  return app;
}