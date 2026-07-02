import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite (Node-powered) dev server + build. The React plugin enables JSX/Fast
// Refresh. .html partials are imported as raw strings via the ?raw suffix.
export default defineConfig({
  plugins: [react()],
  // In dev the Vite server proxies /api to the Express backend (run it with
  // `npm run server` in another terminal), so cookies and the API are
  // same-origin from the browser's point of view.
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2019',
    cssCodeSplit: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Split React into its own long-cached vendor chunk so app updates
        // don't bust the (rarely-changing) framework cache on repeat visits.
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
