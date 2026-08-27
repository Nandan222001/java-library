import 'dotenv/config';
import app from './app.js';

/* Local dev only — Vercel imports `api/index.js` (the exported Express app)
 * instead of running this listener. Keeping both paths on the SAME Express
 * instance guarantees identical behaviour locally and in production. */
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () =>
  console.log(`☕ Java Library API listening on http://localhost:${PORT}`));