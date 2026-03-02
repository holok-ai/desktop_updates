/**
 * Error Handling E2E Tests
 *
 * Validates: Requirements 17.1
 * - Navigating to invalid route redirects to home (NotFound behavior)
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Error Handling', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    // Wait for sidebar to confirm app is fully rendered and authenticated
    await expect(page.locator('nav[aria-label="Main sidebar"]')).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('navigating to invalid route redirects to home', async () => {
    // Requirement 17.1: invalid route triggers NotFound which redirects to home
    // Intentional direct hash navigation to test error handling for invalid routes
    await page.evaluate(() => {
      window.location.hash = '#/this-route-does-not-exist-at-all';
    });

    // The NotFound component calls replace(ROUTE.HOME) on mount,
    // so we should end up at the home/dashboard route
    await expect(page).not.toHaveURL(/this-route-does-not-exist/, { timeout: 10000 });
  });
});
