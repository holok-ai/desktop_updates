/**
 * Shared helpers for thread context menu E2E tests.
 * Reduces duplication across thread-context-menu, thread-rename,
 * thread-delete, and thread-favorite spec files.
 */

import { expect } from '@playwright/test';
import type { Page } from 'playwright';

/**
 * Open the context menu on the first thread item in the list.
 * Returns the first `.thread-item-container` locator.
 */
export async function openFirstThreadContextMenu(page: Page) {
  const firstItem = page.locator('.thread-item-container').first();
  await firstItem.hover();

  const menuTrigger = firstItem.locator('.menu-trigger');
  await expect(menuTrigger).toBeVisible({ timeout: 5000 });
  await menuTrigger.click();

  const contextMenu = page.locator('.context-menu[role="menu"]');
  await expect(contextMenu).toBeVisible({ timeout: 5000 });

  return firstItem;
}

/**
 * Open the context menu on the thread with the given id.
 * Use this to target a specific thread (e.g. one created during the test) so
 * cleanup does not affect other threads.
 */
export async function openThreadContextMenuByThreadId(page: Page, threadId: string) {
  const item = page.locator(`.thread-item-container[data-thread-id="${threadId}"]`);
  await expect(item).toBeVisible({ timeout: 10000 });
  await item.hover();

  const menuTrigger = item.locator('.menu-trigger');
  await expect(menuTrigger).toBeVisible({ timeout: 5000 });
  await menuTrigger.click();

  const contextMenu = page.locator('.context-menu[role="menu"]');
  await expect(contextMenu).toBeVisible({ timeout: 5000 });

  return item;
}

/**
 * Close any open context menu by clicking on the page body.
 */
export async function closeContextMenu(page: Page) {
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  const contextMenu = page.locator('.context-menu[role="menu"]');
  await expect(contextMenu).not.toBeVisible({ timeout: 5000 });
}

/**
 * Click a menu item by text from an already-open context menu.
 */
export async function clickMenuItem(page: Page, text: string) {
  const menuItem = page.locator('.menu-item[role="menuitem"]', { hasText: text });
  await expect(menuItem).toBeVisible({ timeout: 3000 });
  await menuItem.click();
  const contextMenu = page.locator('.context-menu[role="menu"]');
  await expect(contextMenu).not.toBeVisible({ timeout: 5000 });
}

/**
 * Click the danger menu item (e.g. "Delete Thread") from an already-open context menu.
 */
export async function clickDangerMenuItem(page: Page, text: string) {
  const menuItem = page.locator('.menu-item-danger[role="menuitem"]', { hasText: text });
  await expect(menuItem).toBeVisible({ timeout: 3000 });
  await menuItem.click();
  const contextMenu = page.locator('.context-menu[role="menu"]');
  await expect(contextMenu).not.toBeVisible({ timeout: 5000 });
}

/**
 * Wait for the threads loading state to finish.
 * Waits for any loading indicator to disappear, then waits for either
 * thread items or the empty state to be visible.
 */
async function waitForThreadsLoaded(page: Page) {
  // Wait for loading text/spinner to disappear
  const loading = page.getByText('Loading threads...');
  await loading.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});

  // Wait for either thread items or empty state to appear
  const threadItems = page.locator('.thread-item-container');
  const emptyState = page.getByText('No threads yet');
  await expect(threadItems.first().or(emptyState))
    .toBeVisible({ timeout: 10000 })
    .catch(() => {});
}

/**
 * Navigate to the threads list page and verify it loaded.
 * If the thread list is empty, performs a navigation workaround
 * (Projects → Search → Threads) to force a data refresh.
 */
export async function navigateToThreads(page: Page) {
  await page.locator('button[aria-label="Threads"]').click();
  await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });

  await waitForThreadsLoaded(page);

  // Check if threads loaded; if empty, navigate away and back to force refresh
  const threadItems = page.locator('.thread-item-container');
  const count = await threadItems.count();
  if (count === 0) {
    await page.locator('button[aria-label="Projects"]').click();
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });

    await page.locator('button[aria-label="Search"]').click();
    await expect(page).toHaveURL(/\/search/, { timeout: 10000 });

    await page.locator('button[aria-label="Threads"]').click();
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });

    await waitForThreadsLoaded(page);
  }
}

/**
 * Create a thread via the UI by clicking an application card.
 * Clicks "+ New Thread", waits for application cards and for the app to be ready
 * (models loaded), then clicks the first card and waits for navigation to thread view.
 */
export async function createThreadViaUI(page: Page) {
  await page.locator('button[aria-label="+ New Thread"]').click();

  const cards = page.locator('.application-card');
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  // Wait for loading to finish and allow models to be resolved (card click needs app.models?.[0])
  await page
    .locator('.loading-state')
    .waitFor({ state: 'hidden', timeout: 20000 })
    .catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});

  const card = cards.first();
  await card.click();
  await expect(page).toHaveURL(/threadId=/, { timeout: 30000 });
}
