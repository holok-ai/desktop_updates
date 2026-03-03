/**
 * Search E2E Tests
 *
 * Validates: Requirements 16.1, 16.2, 16.3
 * - Search page shows input field and search button
 * - Submitting a query executes search and shows results area
 * - Empty query prevents search execution
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Search', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Navigate to Search page via sidebar
    await page.locator('button[aria-label="Search"]').click();
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('search page shows input field and search button', async () => {
    // Requirement 16.1: displays search input and search button
    const searchPage = page.locator('.search-page');
    await expect(searchPage).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('.search-input');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await expect(searchInput).toHaveAttribute('placeholder', /Search/);

    const searchButton = page.locator('.search-button');
    await expect(searchButton).toBeVisible({ timeout: 5000 });
    await expect(searchButton).toContainText('Search');
  });

  test('submitting a query executes search and shows results area', async () => {
    // Requirement 16.2: typing query and pressing Enter shows results
    const searchInput = page.locator('.search-input');
    await searchInput.fill('test query');
    await page.waitForTimeout(300);

    // Press Enter to search
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Results area should appear
    const searchResults = page.locator('.search-results');
    await expect(searchResults).toBeVisible({ timeout: 5000 });
  });

  test('empty query prevents search execution', async () => {
    // Requirement 16.3: empty query does not trigger search
    // Navigate away and back to reset search state
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(1000);
    await page.locator('button[aria-label="Search"]').click();
    await page.waitForTimeout(1000);

    // Verify we're on a fresh search page (no results yet)
    const searchResults = page.locator('.search-results');
    await expect(searchResults).not.toBeVisible({ timeout: 3000 });

    // Try clicking search with empty input
    const searchInput = page.locator('.search-input');
    await expect(searchInput).toHaveValue('');

    const searchButton = page.locator('.search-button');
    await searchButton.click();
    await page.waitForTimeout(500);

    // Results area should still NOT appear
    await expect(searchResults).not.toBeVisible({ timeout: 3000 });
  });
});
