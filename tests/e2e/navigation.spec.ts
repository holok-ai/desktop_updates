/**
 * Sidebar Navigation E2E Tests
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9
 * - Sidebar displays all menu items (New Thread, Search, Projects, Threads)
 * - Clicking each nav item navigates to the correct route
 * - Sidebar collapse toggle hides labels and sections
 *
 * Note: There is no "Home" button in the sidebar. Dashboard is accessed via direct URL.
 * The sidebar activities are: + New Thread, Search, Projects, Threads
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe('Sidebar Navigation', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('sidebar displays all menu items', async () => {
    // Requirement 3.1: Sidebar shows New Thread, Search, Projects, Threads
    const sidebar = page.locator('nav[aria-label="Main sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Nav buttons use aria-label matching the activity labels
    await expect(page.locator('button[aria-label="+ New Thread"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Search"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Projects"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Threads"]')).toBeVisible();
  });

  test('clicking Threads navigates to threads list', async () => {
    // Requirement 3.3
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
  });

  test('clicking Projects navigates to projects list', async () => {
    // Requirement 3.4
    await page.locator('button[aria-label="Projects"]').click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });
  });

  test('clicking Search navigates to search page', async () => {
    // Requirement 3.5
    await page.locator('button[aria-label="Search"]').click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/search/, { timeout: 10000 });
  });

  test('clicking New Thread navigates to thread creation', async () => {
    // Requirement 3.6
    await page.locator('button[aria-label="+ New Thread"]').click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/threads\/new/, { timeout: 10000 });
  });

  test('sidebar collapse toggle hides labels and sections', async () => {
    // Requirement 3.9
    const sidebar = page.locator('nav[aria-label="Main sidebar"]');

    // Sidebar should not be collapsed initially
    await expect(sidebar).not.toHaveClass(/collapsed/, { timeout: 5000 });

    // Click collapse button
    const collapseBtn = page.locator('button[aria-label="Collapse sidebar"]');
    await expect(collapseBtn).toBeVisible({ timeout: 5000 });
    await collapseBtn.click();
    await page.waitForTimeout(500);

    // Sidebar should now have collapsed class
    await expect(sidebar).toHaveClass(/collapsed/, { timeout: 5000 });

    // Favorites and Recent sections should be hidden when collapsed
    const favoritesSection = sidebar.locator('.favorites-section');
    const recentSection = sidebar.locator('.recent-section');
    await expect(favoritesSection).toBeHidden();
    await expect(recentSection).toBeHidden();

    // Expand it back
    const expandBtn = page.locator('button[aria-label="Expand sidebar"]');
    await expect(expandBtn).toBeVisible({ timeout: 5000 });
    await expandBtn.click();
    await page.waitForTimeout(500);

    // Should be expanded again
    await expect(sidebar).not.toHaveClass(/collapsed/, { timeout: 5000 });
  });
});
