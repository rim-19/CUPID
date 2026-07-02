import { renderToString } from 'react-dom/server';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

/* Rendered at build time by prerender.js so the served HTML contains real
   content (for crawlers, link unfurlers, and no-JS), then hydrated on the
   client. The imperative runtime only runs in a client effect, so none of it
   executes here - the partials render as their static markup. */
export function render() {
  return renderToString(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
