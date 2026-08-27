import 'dotenv/config';
import app from '../src/app.js';

/* Vercel serverless entry — Root Directory: server
 * Vercel auto-bundles `/api/*.js` with @vercel/node and wires the exported
 * Express app. No app.listen() here: Vercel invokes this as a function.
 * Route mounting inside src/app.js already prefixes everything with /api. */
export default app;