/**
 * Thread View Tab Content E2E Tests
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

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
    await page.locator('button[aria-label="+ New Thread"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/threads\/applications/, { timeout: 10000 });

    const cards = page.locator('.application-card');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    await cards.first().click();
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/threadId=/, { timeout: 30000 });

    const chatView = page.locator('.thread-chat-view');
    await expect(chatView).toBeVisible({ timeout: 30000 });
  });

  test('switching to Prompt tab displays the prompt view', async () => {
    const viewSelector = page.locator('.view-selector');
    await expect(viewSelector).toBeVisible({ timeout: 5000 });

    // Hover to reveal all tabs, then click Prompt (index 1)
    await viewSelector.hover();
    await page.waitForTimeout(500);
    const tabs = viewSelector.locator('button[role="tab"]');
    await expect(tabs).toHaveCount(5, { timeout: 5000 });
    await tabs.nth(1).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.thread-prompt-view')).toBeVisible({ timeout: 5000 });
  });

  test('switching to Graphic tab displays the graphic view', async () => {
    const viewSelector = page.locator('.view-selector');
    await viewSelector.hover();
    await page.waitForTimeout(300);
    const tabs = viewSelector.locator('button[role="tab"]');
    await tabs.nth(2).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.thread-graphic-view')).toBeVisible({ timeout: 5000 });
  });

  test('switching to Execution tab displays stub view with "Execution View" heading', async () => {
    const viewSelector = page.locator('.view-selector');
    await viewSelector.hover();
    await page.waitForTimeout(300);
    const tabs = viewSelector.locator('button[role="tab"]');
    await tabs.nth(3).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.stub-view h3', { hasText: 'Execution View' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('switching to File tab displays stub view with "File View" heading', async () => {
    const viewSelector = page.locator('.view-selector');
    await viewSelector.hover();
    await page.waitForTimeout(300);
    const tabs = viewSelector.locator('button[role="tab"]');
    await tabs.nth(4).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.stub-view h3', { hasText: 'File View' })).toBeVisible({
      timeout: 5000,
    });
  });

  test('switching back to Chat tab restores the chat view with messages visible', async () => {
    const viewSelector = page.locator('.view-selector');
    await viewSelector.hover();
    await page.waitForTimeout(300);
    const tabs = viewSelector.locator('button[role="tab"]');
    await tabs.nth(0).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.thread-chat-view')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.messages-area')).toBeVisible({ timeout: 5000 });
  });
});
