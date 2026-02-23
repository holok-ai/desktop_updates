/**
 * Error Handling E2E Tests
 *
 * Validates: Requirements 17.1, 17.4
 * - Navigating to invalid route redirects to home (NotFound behavior)
 * - Token refresh works with expired access token
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import {
  launchAuthenticatedApp,
  getFirstWindow,
  verifyAuthenticated,
} from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Error Handling', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('navigating to invalid route redirects to home', async () => {
    // Requirement 17.1: invalid route triggers NotFound which redirects to home
    // Navigate to a nonsense route
    await page.evaluate(() => {
      window.location.hash = '#/this-route-does-not-exist-at-all';
    });
    await page.waitForTimeout(2000);

    // The NotFound component calls replace(ROUTE.HOME) on mount,
    // so we should end up at the home/dashboard route
    const url = page.url();
    // Should have been redirected — hash should be empty or '/' (home/ApplicationThread page)
    expect(url).not.toContain('this-route-does-not-exist');
  });

  test('token refresh works with expired access token', async () => {
    // Requirement 17.4: app auto-refreshes expired tokens
    // The test fixture uses an expired accessToken with a valid long-lived apiKey.
    // If we got this far with a working app, token refresh is working.
    const isAuth = await verifyAuthenticated(page);
    expect(isAuth).toBe(true);

    // Verify we can still navigate (proves API calls work with refreshed token)
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(2000);

    const threadsPage = page.locator('.threads-page');
    await expect(threadsPage).toBeVisible({ timeout: 10000 });
  });
});
