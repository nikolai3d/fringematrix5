import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: false, // Run tests sequentially to avoid Blob API rate limits
  workers: 2, // Use 2 workers for balanced speed vs rate limit protection
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 90_000, // 90 seconds for individual tests
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 60_000, // 60 seconds for individual actions (like waiting for elements)
    navigationTimeout: 60_000, // 60 seconds for page navigation
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start backend server; client build is triggered by the e2e npm script before tests
  webServer: {
    command: 'node ../server/server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});


