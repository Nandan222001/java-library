import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { installContentProtection } from './lib/contentProtection.js';
import './index.css';

installContentProtection();

/* NOTE: StrictMode intentionally omitted — the reader mounts a heavyweight
 * legacy flip-book engine whose lifecycle must run exactly once per mount. */
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);