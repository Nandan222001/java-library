import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // same-origin /api in dev → no CORS juggling; prod: deploy behind
      // one origin or set VITE_API_URL to the public API base instead.
      '/api': 'http://localhost:8080'
    }
  },
  build: { outDir: 'dist', sourcemap: false }
});