import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';

// Extra conservative configuration for local testing when hitting rate limits
export default defineConfig({
  ...baseConfig,
  workers: 1, // Ensure only 1 worker
  fullyParallel: false, // Ensure sequential execution
  timeout: 120_000, // Even longer timeout (2 minutes)
  use: {
    ...baseConfig.use,
    actionTimeout: 90_000, // 1.5 minutes for actions
    navigationTimeout: 90_000, // 1.5 minutes for navigation
  },
  // Add a longer delay between tests
  globalSetup: undefined,
  globalTeardown: undefined,
});
