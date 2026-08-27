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