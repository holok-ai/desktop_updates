import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 5 * 60 * 1000,
  expect: {
    timeout: 10000, // Increased from 5000ms to 10000ms for assertions
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
  ],
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Set default timeout for page methods like waitForFunction
    actionTimeout: 120000, // 2 minutes for actions
  },
  projects: [
    {
      name: 'electron',
      testMatch: /.*\.spec\.ts/,
    },
  ],
});
