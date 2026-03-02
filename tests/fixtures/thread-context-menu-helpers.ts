/**
 * Shared helpers for thread context menu E2E tests.
 * Reduces duplication across thread-context-menu, thread-rename,
 * thread-delete, and thread-favorite spec files.
 */

import { expect } from '@playwright/test';
import type { Page } from 'playwright';
import { refreshTokenViaElectron } from '../helpers/token-helpers';

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
 * Navigate away and back to force a token/data refresh.
 * Useful when the app shows auth-related errors like "No assistants".
 */
async function forceRefreshViaNavigation(page: Page) {
  await page.locator('button[aria-label="Search"]').click();
  await expect(page).toHaveURL(/\/search/, { timeout: 10000 });

  await page.locator('button[aria-label="Threads"]').click();
  await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
}

/**
 * Create a thread via the UI by clicking an application card.
 * If the "New Thread" page shows an error (e.g. "No assistants"),
 * tries the Retry button first, then navigates away and retries
 * to force a token refresh. Returns on the thread view page.
 */
export async function createThreadViaUI(page: Page) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await page.locator('button[aria-label="+ New Thread"]').click();

    // Wait for either application cards or the "No assistants" error
    const cards = page.locator('.application-card');
    const noAssistants = page.getByText('No assistants have been assigned');
    const retryBtn = page.getByRole('button', { name: 'Retry' });

    // Wait up to 15s for either cards or the error message to appear
    await expect(cards.first().or(noAssistants))
      .toBeVisible({ timeout: 15000 })
      .catch(() => {});

    const hasError = await noAssistants.isVisible().catch(() => false);
    const hasCards = await cards
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasCards && !hasError && attempt < maxAttempts) {
      // Neither cards nor error appeared — still loading or timed out
      // Navigate away and retry to force a fresh load
      await forceRefreshViaNavigation(page);
      continue;
    }

    if (hasError && attempt < maxAttempts) {
      // Try the Retry button first
      const canRetry = await retryBtn.isVisible().catch(() => false);
      if (canRetry) {
        // Programmatically refresh the token before retrying
        await refreshTokenViaElectron(page).catch(() => {});
        await retryBtn.click();

        // Wait for cards to appear after retry
        await expect(cards.first())
          .toBeVisible({ timeout: 10000 })
          .catch(() => {});

        // Check if retry resolved the issue
        const cardsNow = await cards
          .first()
          .isVisible()
          .catch(() => false);
        if (!cardsNow) {
          // Retry button didn't help — navigate away to force full refresh
          await forceRefreshViaNavigation(page);
          continue;
        }
        // Cards appeared after retry — fall through to the click logic below
      } else {
        // No retry button — navigate away to force full refresh
        await forceRefreshViaNavigation(page);
        continue;
      }
    }

    // Cards should be visible at this point
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    await cards.first().click();

    await expect(page).toHaveURL(/threadId=/, { timeout: 30000 });
    return;
  }
}
