import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import meRoutes from './routes/me.js';
import libraryRoutes from './routes/library.js';
import billingRoutes from './routes/billing.js';
import adminRoutes from './routes/admin.js';

/** Build the Express app WITHOUT binding a port. Exporting `app` lets Vercel
 *  wrap it as a serverless function while `index.js` (local dev) calls listen. */
export function buildApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
      .split(',').map(s => s.trim()),
    credentials: false
  }));
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
  app.use('/api/billing', billingRoutes);
  app.use('/api/admin', adminRoutes);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[API ERROR]', err.message);
    res.status(err.status || 500)
       .json({ error: err.expose ? err.message : 'Internal error' });
  });

  return app;
}

export default buildApp();