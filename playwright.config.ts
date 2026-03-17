import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E configuration for Mitigation Rules Engine.
 *
 * Prerequisites:
 *   1. Run `npx playwright install chromium` once to download the browser binary.
 *   2. Start the backend:  cd server && npx tsx src/index.ts   (port 3000)
 *   3. Start the frontend: cd client && npx vite                (port 5173)
 *   4. Ensure the test DB is seeded with seed users and rules.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
