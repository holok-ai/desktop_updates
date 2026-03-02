/**
 * Thread Favorite Toggle E2E Tests
 *
 * Validates: Requirements 4.1, 4.2 (Thread Favorite Toggle)
 * - Clicking Make Favorite adds thread to sidebar Favorites section
 * - Clicking Remove Favorite removes thread from sidebar Favorites section
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import {
  openFirstThreadContextMenu,
  clickMenuItem,
  closeContextMenu,
  navigateToThreads,
} from '../fixtures/thread-context-menu-helpers';

let app: ElectronApplication;
let page: Page;

/** Ensure the first thread is NOT favorited (clean state). */
async function ensureNotFavorited(page: Page) {
  await openFirstThreadContextMenu(page);

  const menuItems = page.locator('.context-menu[role="menu"] .menu-item[role="menuitem"]');
  const firstMenuText = await menuItems.first().textContent();

  if (firstMenuText!.includes('Remove Favorite')) {
    await menuItems.first().click();
    // Wait for the favorite state to update in the sidebar
    const favoritesSection = page.locator('.favorites-section');
    await favoritesSection.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  } else {
    await closeContextMenu(page);
  }
}

test.describe.serial('Thread Favorite Toggle', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    // Wait for the app shell to be fully rendered after launch
    await expect(page.locator('.app-layout')).toBeVisible({ timeout: 10000 });

    await navigateToThreads(page);

    // Wait for thread items to appear after navigation (including workaround)
    const threadItems = page.locator('.thread-item-container');
    try {
      await threadItems.first().waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      throw new Error('No threads available for favorite tests');
    }

    const count = await threadItems.count();
    if (count === 0) {
      throw new Error('No threads available for favorite tests');
    }
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('clicking Make Favorite adds thread to sidebar Favorites section', async () => {
    // Requirement 4.1
    await ensureNotFavorited(page);

    // Requirement 6.3: clicking a thread navigates to thread view
    const threadItems = page.locator('.thread-item');
    const count = await threadItems.count();

    if (count === 0) {
      // No threads — skip this test gracefully
      test.skip();
      return;
    }

    const firstItem = page.locator('.thread-item-container').first();
    const threadTitle = await firstItem.locator('.thread-item-title').textContent();

    await openFirstThreadContextMenu(page);
    await clickMenuItem(page, 'Make Favorite');

    // Verify thread appears in sidebar Favorites section
    const favoritesSection = page.locator('.favorites-section');
    await expect(favoritesSection).toBeVisible({ timeout: 5000 });

    const favHeader = favoritesSection.locator('.recent-header');
    await favHeader.hover();
    await expect(favHeader).toBeVisible({ timeout: 3000 });
    await favHeader.click();

    const favoriteItems = favoritesSection.locator('.recent-thread-item');
    const favTexts = await favoriteItems.allTextContents();
    expect(favTexts.some((t) => t.includes(threadTitle!.trim()))).toBe(true);

    // Verify context menu now shows "Remove Favorite"
    await openFirstThreadContextMenu(page);

    const removeFavItem = page.locator('.menu-item[role="menuitem"]', {
      hasText: 'Remove Favorite',
    });
    await expect(removeFavItem).toBeVisible({ timeout: 3000 });

    await closeContextMenu(page);
  });

  test('clicking Remove Favorite removes thread from sidebar Favorites section', async () => {
    // Requirement 4.2
    const firstItem = page.locator('.thread-item-container').first();
    const threadTitle = await firstItem.locator('.thread-item-title').textContent();

    await openFirstThreadContextMenu(page);
    await clickMenuItem(page, 'Remove Favorite');

    // Verify thread is no longer in sidebar Favorites section
    const favoritesSection = page.locator('.favorites-section');

    if (await favoritesSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      const favHeader = favoritesSection.locator('.recent-header');
      await favHeader.hover();
      await expect(favHeader).toBeVisible({ timeout: 3000 });
      await favHeader.click();

      const favoriteItems = favoritesSection.locator('.recent-thread-item');
      const favCount = await favoriteItems.count();

      if (favCount > 0) {
        const favTexts = await favoriteItems.allTextContents();
        expect(favTexts.some((t) => t.includes(threadTitle!.trim()))).toBe(false);
      }
    }

    // Verify context menu now shows "Make Favorite"
    await openFirstThreadContextMenu(page);

    const makeFavItem = page.locator('.menu-item[role="menuitem"]', { hasText: 'Make Favorite' });
    await expect(makeFavItem).toBeVisible({ timeout: 3000 });

    await closeContextMenu(page);
  });
});
