/**
 * Thread Context Menu Visibility E2E Tests
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4 (Context Menu Visibility)
 * - Thread list has items
 * - Clicking ellipsis opens context menu with expected items
 * - Clicking outside closes the context menu
 * - Clicking ellipsis again toggles menu closed
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import {
  openFirstThreadContextMenu,
  closeContextMenu,
  navigateToThreads,
} from '../fixtures/thread-context-menu-helpers';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Thread Context Menu', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('navigate to threads page and verify thread list has items', async () => {
    await navigateToThreads(page);

    const threadItems = page.locator('.thread-item-container');
    const count = await threadItems.count();
    if (count === 0) {
      test.skip();
    }
  });

  test('clicking the ellipsis button opens the context menu with expected items', async () => {
    // Requirement 1.2
    await openFirstThreadContextMenu(page);

    const menuItems = page.locator('.context-menu[role="menu"] .menu-item[role="menuitem"]');
    const menuTexts = await menuItems.allTextContents();

    const hasFavoriteOption =
      menuTexts.some((t) => t.includes('Make Favorite')) ||
      menuTexts.some((t) => t.includes('Remove Favorite'));
    expect(hasFavoriteOption).toBe(true);
    expect(menuTexts.some((t) => t.includes('Rename'))).toBe(true);
    expect(menuTexts.some((t) => t.includes('Move'))).toBe(true);
    expect(menuTexts.some((t) => t.includes('Delete Thread'))).toBe(true);

    await closeContextMenu(page);
  });

  test('clicking outside the context menu closes it', async () => {
    // Requirement 1.3
    await openFirstThreadContextMenu(page);

    await closeContextMenu(page);

    const contextMenu = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu).not.toBeVisible({ timeout: 5000 });
  });

  test('clicking the ellipsis button again while open closes the context menu', async () => {
    // Requirement 1.4
    const firstItem = page.locator('.thread-item-container').first();
    await firstItem.hover();
    await page.waitForTimeout(300);

    const menuTrigger = firstItem.locator('.menu-trigger');
    await menuTrigger.click();
    await page.waitForTimeout(300);

    const contextMenu = page.locator('.context-menu[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    await menuTrigger.click();
    await page.waitForTimeout(300);

    await expect(contextMenu).not.toBeVisible({ timeout: 5000 });
  });
});
