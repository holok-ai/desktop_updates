/**
 * Thread View Tab Content E2E Tests
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createThreadViaUI } from '../fixtures/thread-context-menu-helpers';

let app: ElectronApplication;
let page: Page;

/**
 * Hover the view-selector and wait until all 5 tabs are visible.
 * Retries the hover if tabs don't appear (Electron driver can be flaky).
 */
async function hoverAndWaitForTabs(pg: Page): Promise<void> {
  const viewSelector = pg.locator('.view-selector');
  const tabs = viewSelector.locator('button[role="tab"]');
  for (let attempt = 0; attempt < 3; attempt++) {
    await viewSelector.hover({ force: true });
    try {
      await expect(tabs).toHaveCount(5, { timeout: 3000 });
      return;
    } catch {
      // Move mouse away and retry
      await pg.mouse.move(0, 0);
      await pg.waitForTimeout(300);
    }
  }
  // Final attempt — let it throw if it still fails
  await viewSelector.hover({ force: true });
  await expect(tabs).toHaveCount(5, { timeout: 5000 });
}

test.describe.serial('Thread View Tabs', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('create a thread via application card flow for tab testing', async () => {
    await createThreadViaUI(page);

    const chatView = page.locator('.thread-chat-view');
    await expect(chatView).toBeVisible({ timeout: 30000 });
  });

  test('switching to Prompt tab displays the prompt view', async () => {
    const viewSelector = page.locator('.view-selector');
    await expect(viewSelector).toBeVisible({ timeout: 5000 });

    await hoverAndWaitForTabs(page);
    const tabs = viewSelector.locator('button[role="tab"]');
    await tabs.nth(1).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.thread-prompt-view')).toBeVisible({ timeout: 5000 });
  });

  test('switching to Graphic tab displays the graphic view', async () => {
    await hoverAndWaitForTabs(page);
    const tabs = page.locator('.view-selector').locator('button[role="tab"]');
    await tabs.nth(2).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.thread-graphic-view')).toBeVisible({ timeout: 5000 });
  });

  test('switching to Execution tab displays stub view with "Execution View" heading', async () => {
    await hoverAndWaitForTabs(page);
    const tabs = page.locator('.view-selector').locator('button[role="tab"]');
    await tabs.nth(3).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.stub-view h3', { hasText: 'Execution View' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('switching to File tab displays stub view with "File View" heading', async () => {
    await hoverAndWaitForTabs(page);
    const tabs = page.locator('.view-selector').locator('button[role="tab"]');
    await tabs.nth(4).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.stub-view h3', { hasText: 'File View' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('switching back to Chat tab restores the chat view with messages visible', async () => {
    await hoverAndWaitForTabs(page);
    const tabs = page.locator('.view-selector').locator('button[role="tab"]');
    await tabs.nth(0).click();
    await page.waitForTimeout(1000);

    // Chat view re-mounts after tab switch — give it time to load thread data
    await expect(page.locator('.thread-chat-view')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.messages-area')).toBeVisible({ timeout: 10000 });
  });
});
