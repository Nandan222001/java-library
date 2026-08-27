import 'dotenv/config';
import app from '../src/app.js';

/* Vercel serverless entry — Root Directory: server.
 *
 * With api/index.js Vercel serves this function at root and, after our
 * vercel.json rewrites, at /api/*. Our Express routes are all mounted under
 * the /api prefix, so normalize the incoming path defensively: if it arrives
 * WITHOUT the /api prefix (e.g. Vercel mapped /health → root), re-add it so
 * Express matches the correct router. If it already starts with /api (the
 * original URL is preserved), pass it straight through. */
export default function handler(req, res) {
  const url = req.url || '/';
  if (!url.startsWith('/api')) {
    req.url = `/api${url.startsWith('/') ? url : `/${url}`}`;
  }
  return app(req, res);
}