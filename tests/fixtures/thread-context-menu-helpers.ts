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
  await page.waitForTimeout(300);

  const menuTrigger = firstItem.locator('.menu-trigger');
  await expect(menuTrigger).toBeVisible({ timeout: 5000 });
  await menuTrigger.click();
  await page.waitForTimeout(300);

  const contextMenu = page.locator('.context-menu[role="menu"]');
  await expect(contextMenu).toBeVisible({ timeout: 5000 });

  return firstItem;
}

/**
 * Close any open context menu by clicking on the page body.
 */
export async function closeContextMenu(page: Page) {
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(300);
}

/**
 * Click a menu item by text from an already-open context menu.
 */
export async function clickMenuItem(page: Page, text: string) {
  const menuItem = page.locator('.menu-item[role="menuitem"]', { hasText: text });
  await expect(menuItem).toBeVisible({ timeout: 3000 });
  await menuItem.click();
  await page.waitForTimeout(500);
}

/**
 * Click the danger menu item (e.g. "Delete Thread") from an already-open context menu.
 */
export async function clickDangerMenuItem(page: Page, text: string) {
  const menuItem = page.locator('.menu-item-danger[role="menuitem"]', { hasText: text });
  await expect(menuItem).toBeVisible({ timeout: 3000 });
  await menuItem.click();
  await page.waitForTimeout(500);
}

/**
 * Navigate to the threads list page and verify it loaded.
 */
export async function navigateToThreads(page: Page) {
  await page.locator('button[aria-label="Threads"]').click();
  await page.waitForTimeout(2000);
  await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
}

/**
 * Create a thread via the UI by clicking an application card.
 * Returns on the thread view page.
 */
export async function createThreadViaUI(page: Page) {
  await page.locator('button[aria-label="+ New Thread"]').click();
  await page.waitForTimeout(3000);

  const cards = page.locator('.application-card');
  await expect(cards.first()).toBeVisible({ timeout: 15000 });

  await cards.first().click();
  await page.waitForTimeout(5000);

  await expect(page).toHaveURL(/threadId=/, { timeout: 15000 });
}
