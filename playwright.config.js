import { defineConfig, devices } from '@playwright/test';

/* E2E against the production build served by Node.
   Run `npm run build` first, then `npm run test:e2e`.
   (One-time: `npx playwright install chromium`.) */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
