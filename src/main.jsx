import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { reportWebVitals } from './vitals';

/* No StrictMode: the interaction layer is imperative (scroll listeners,
   particles, IntersectionObservers), and StrictMode's double-invoke in dev
   would attach it twice. initApp() is idempotent, but this keeps dev clean. */
const root = document.getElementById('root');
const tree = (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Hydrate the pre-rendered markup when present (production); otherwise mount
// fresh (dev server, where index.html ships an empty #root).
if (root.firstElementChild) {
  hydrateRoot(root, tree);
} else {
  createRoot(root).render(tree);
}

reportWebVitals();
