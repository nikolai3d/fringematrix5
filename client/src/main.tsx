import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles.css';

// Promote the preloaded font stylesheet (CSP-safe: inline onload handlers are
// blocked by our script-src 'self' policy, so we flip rel here in bundled JS).
const fontCss = document.getElementById('font-css') as HTMLLinkElement | null;
if (fontCss && fontCss.rel !== 'stylesheet') fontCss.rel = 'stylesheet';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);


