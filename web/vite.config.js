import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Dev only: allow tunnel/preview hosts (Vite 5.4+ blocks unknown Host
    // headers by default). Unrelated to the production build.
    allowedHosts: ['.e2b.app', '.vercel.app', 'localhost'],
    proxy: {
      // same-origin /api in dev → no CORS juggling; prod: deploy behind
      // one origin or set VITE_API_URL to the public API base instead.
      '/api': 'http://localhost:8080'
    }
  },
  build: { outDir: 'dist', sourcemap: false }
});