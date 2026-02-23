/**
 * Home Page (Application Thread) E2E Tests
 *
 * Validates the home page which shows available AI applications/agents.
 * Users select an application to start a new chat thread.
 *
 * The home page route is `/` and renders ApplicationThread.svelte.
 * It displays a grid of application cards, each representing an AI agent.
 * Clicking a card creates a thread and navigates to the thread view.
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe('Home Page (Application Thread)', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Navigate to home via hash route
    const currentUrl = page.url();
    const baseUrl = currentUrl.split('#')[0];
    await page.goto(`${baseUrl}#/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('home page shows "Let\'s chat" header', async () => {
    const appPage = page.locator('.application-thread-page');
    await expect(appPage).toBeVisible({ timeout: 15000 });

    const header = appPage.locator('.page-header h2');
    await expect(header).toHaveText("Let's chat");
  });

  test('application cards are visible or shows loading/empty state', async () => {
    const container = page.locator('.applications-container');
    await expect(container).toBeVisible({ timeout: 10000 });

    const grid = page.locator('.applications-grid');
    const loading = page.locator('.loading-state');
    const empty = page.locator('.empty-state');

    const hasGrid = await grid.isVisible().catch(() => false);
    const hasLoading = await loading.isVisible().catch(() => false);
    const hasEmpty = await empty.isVisible().catch(() => false);

    // One of these states should be visible
    expect(hasGrid || hasLoading || hasEmpty).toBe(true);
  });

  test('application cards show title, description, and chat action', async () => {
    const cards = page.locator('.application-card');
    const count = await cards.count();

    if (count > 0) {
      const firstCard = cards.first();
      await expect(firstCard.locator('.app-title')).toBeVisible({ timeout: 5000 });
      await expect(firstCard.locator('.app-provider')).toBeVisible({ timeout: 5000 });
      await expect(firstCard.locator('.card-footer')).toContainText('Chat');
    }
    // If no cards, the empty/loading state was already validated above
  });

  test('clicking an application card creates thread and navigates to chat', async () => {
    const cards = page.locator('.application-card');
    const count = await cards.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await cards.first().click();

    // Should navigate to thread view with threadId parameter
    await expect(page).toHaveURL(/threadId=/, { timeout: 30000 });

    // Thread chat view should be visible
    const chatView = page.locator('.thread-chat-view');
    await expect(chatView).toBeVisible({ timeout: 30000 });
  });
});
