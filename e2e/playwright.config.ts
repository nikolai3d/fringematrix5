import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: false, // Run tests sequentially to avoid Blob API rate limits
  workers: process.env.CI ? 2 : 2, // Use 1 worker in CI, 2 for local development
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: process.env.CI ? 120_000 : 90_000, // Longer timeout in CI (2 minutes vs 90 seconds)
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: process.env.CI ? 90_000 : 60_000, // 90s in CI, 60s locally
    navigationTimeout: process.env.CI ? 90_000 : 60_000, // 90s in CI, 60s locally
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start backend server; client build is triggered by the e2e npm script before tests
  webServer: {
    command: 'cd .. && npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});


