import 'dotenv/config';
import { buildApp } from './app.js';

const start = async () => {
  const app = await buildApp();
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () =>
    console.log(`☕ Java Library API listening on http://0.0.0.0:${PORT}`));
};

start();