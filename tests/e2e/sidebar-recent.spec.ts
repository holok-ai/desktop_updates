/**
 * Sidebar Recent E2E Tests
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * Tests sidebar recent section interactions including:
 * - Recent section header visibility
 * - Show/hide toggle on hover
 * - Expanding/collapsing the section
 * - Recent thread display (up to 10) and navigation
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Sidebar Recent', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    // Wait for sidebar to be fully loaded
    await expect(page.locator('.recent-section')).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(async () => {
    await app?.close();
  });

  // ─── Requirement 6.1: Recent section header ───

  test('sidebar displays Recent section header with "Recent" label', async () => {
    const recentSection = page.locator('.recent-section');
    await expect(recentSection).toBeVisible({ timeout: 5000 });

    const label = recentSection.locator('.recent-label');
    await expect(label).toBeVisible({ timeout: 5000 });
    await expect(label).toHaveText('Recent');
  });

  // ─── Requirement 6.2: Show/hide toggle on hover ───

  test('hovering the Recent header reveals the show/hide toggle button', async () => {
    const recentSection = page.locator('.recent-section');
    const header = recentSection.locator('.recent-header');

    // Hover over the header to reveal the toggle
    await header.hover();

    // The toggle uses inline visibility controlled by mouseenter/mouseleave.
    // Use toHaveCSS to wait for the visibility transition after hover.
    const toggle = recentSection.locator('.recent-toggle');
    await expect(toggle).toHaveCSS('visibility', 'visible', { timeout: 5000 });
  });

  // ─── Requirement 6.3, 6.4: Clicking header expands section with up to 10 threads ───

  test('clicking the header expands the section showing up to 10 recent threads with title and model name', async () => {
    const recentSection = page.locator('.recent-section');
    const header = recentSection.locator('.recent-header');

    // Click the header to expand — toggleRecentThreads() loads threads async
    await header.click();

    // Wait for the recent threads list to appear (async thread loading may take time)
    const itemsList = recentSection.locator('.recent-threads');
    await expect(itemsList).toBeVisible({ timeout: 15000 });

    const items = recentSection.locator('.recent-thread-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(10);

    // Verify first item has title and model sublabel
    const firstItem = items.first();
    const title = firstItem.locator('.thread-title');
    await expect(title).toBeVisible({ timeout: 5000 });
    const titleText = await title.textContent();
    expect(titleText!.trim().length).toBeGreaterThan(0);

    // Model sublabel element should exist (may be empty if modelTitle is not set)
    const model = firstItem.locator('.thread-model');
    await expect(model).toBeAttached({ timeout: 5000 });
  });

  // ─── Requirement 6.5: Clicking a recent thread navigates to thread view ───

  test('clicking a recent thread navigates to thread view', async () => {
    const recentSection = page.locator('.recent-section');

    // Ensure the section is expanded before checking items
    const itemsList = recentSection.locator('.recent-threads');
    if (!(await itemsList.isVisible({ timeout: 2000 }).catch(() => false))) {
      const header = recentSection.locator('.recent-header');
      await header.click();
      await expect(itemsList).toBeVisible({ timeout: 5000 });
    }

    const items = recentSection.locator('.recent-thread-item');
    const count = await items.count();

    if (count === 0) {
      test.skip();
      return;
    }

    const firstItem = items.first();
    await firstItem.click();

    // Should navigate to thread view
    await expect(page).toHaveURL(/\/threads\/view\?threadId=/, { timeout: 10000 });

    // Navigate back to threads list for subsequent tests
    await page.locator('button[aria-label="Threads"]').click();
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
  });

  // ─── Requirement 6.6: Clicking hide toggle collapses the section ───

  test('clicking the hide toggle collapses the section', async () => {
    const recentSection = page.locator('.recent-section');
    const header = recentSection.locator('.recent-header');

    // Ensure section is expanded first
    const itemsList = recentSection.locator('.recent-threads');
    if (!(await itemsList.isVisible({ timeout: 2000 }).catch(() => false))) {
      await header.click();
      await expect(itemsList).toBeVisible({ timeout: 5000 });
    }
    await expect(itemsList).toBeVisible({ timeout: 5000 });

    // Hover to reveal the toggle
    await header.hover();

    const toggle = recentSection.locator('.recent-toggle');
    await expect(toggle).toHaveCSS('visibility', 'visible', { timeout: 5000 });

    // Click the toggle to collapse
    await toggle.click();

    // Items should no longer be visible
    await expect(itemsList).not.toBeVisible({ timeout: 5000 });
  });
});
