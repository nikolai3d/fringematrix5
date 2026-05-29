import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles.css';

// Promote the preloaded font stylesheet (CSP-safe: inline onload handlers are
// blocked by our script-src 'self' policy, so we flip rel here in bundled JS).
const fontCss = document.getElementById('font-css') as HTMLLinkElement | null;
if (fontCss && fontCss.rel !== 'stylesheet') fontCss.rel = 'stylesheet';

// Register the service worker (production builds only — the plugin no-ops the
// virtual module in dev). Same-origin /sw.js, so CSP `script-src 'self'` /
// default-src 'self' (worker-src) covers it. Auto-update: a new SW activates
// on the next navigation, so no stale-asset prompt is needed.
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      /* SW registration is best-effort; ignore failures (e.g. dev mode). */
    });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);


