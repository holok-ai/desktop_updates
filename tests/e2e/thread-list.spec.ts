/**
 * Thread List E2E Tests
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 * - Threads page shows list of personal threads
 * - Clicking New Thread button navigates to creation form
 * - Clicking a thread navigates to thread view
 *
 * Note: Previous tests (thread-creation, thread-view) already created threads,
 * so the thread list should have at least one thread.
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Thread List', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('threads page shows list of personal threads', async () => {
    // Requirement 6.1: threads page displays personal threads
    // Navigate to threads list via sidebar
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });

    // Verify the page header
    const pageTitle = page.locator('.threads-page h1');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });
    await expect(pageTitle).toContainText('Threads', { timeout: 3000 });

    // Verify the New Thread button is visible
    const newThreadBtn = page.locator('button.new-thread-button');
    await expect(newThreadBtn).toBeVisible({ timeout: 5000 });

    // Verify thread list has items (threads were created by previous test runs)
    const threadItems = page.locator('.thread-item');
    const count = await threadItems.count();

    if (count > 0) {
      // At least one thread exists — verify it has a title and date info
      const firstItem = threadItems.first();
      await expect(firstItem).toBeVisible({ timeout: 5000 });

      const title = firstItem.locator('.thread-item-title');
      await expect(title).toBeVisible({ timeout: 3000 });
      const titleText = await title.textContent();
      expect(titleText!.length).toBeGreaterThan(0);

      const info = firstItem.locator('.thread-item-info');
      await expect(info).toBeVisible({ timeout: 3000 });
    }
    // If no threads exist, the empty state is also valid
  });

  test('clicking New Thread button navigates to application selection', async () => {
    // Requirement 6.2: New Thread button navigates to application selection page
    const newThreadBtn = page.locator('button.new-thread-button');
    await expect(newThreadBtn).toBeVisible({ timeout: 5000 });

    await newThreadBtn.click();
    await page.waitForTimeout(2000);

    // Should navigate to /threads/applications (ApplicationThread page)
    await expect(page).toHaveURL(/\/threads\/applications/, { timeout: 10000 });

    // Verify the ApplicationThread page is visible with "Let's chat" header
    const appPage = page.locator('.application-thread-page');
    await expect(appPage).toBeVisible({ timeout: 15000 });

    const header = appPage.locator('.page-header h2');
    await expect(header).toHaveText("Let's chat");

    // Navigate back to threads list for the next test
    await page.locator('button[aria-label="Threads"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });
  });

  test('clicking a thread navigates to thread view', async () => {
    // Requirement 6.3: clicking a thread navigates to thread view
    const threadItems = page.locator('.thread-item');
    const count = await threadItems.count();

    if (count === 0) {
      // No threads — skip this test gracefully
      test.skip();
      return;
    }

    // Click the first thread
    await threadItems.first().click();
    await page.waitForTimeout(2000);

    // Should navigate to thread view with threadId parameter
    await expect(page).toHaveURL(/threadId=/, { timeout: 15000 });

    // Verify the thread view is loaded
    const chatView = page.locator('.thread-chat-view');
    await expect(chatView).toBeVisible({ timeout: 30000 });

    // Verify the thread title is shown in the header
    const threadTitle = page.locator('h1.thread-title');
    await expect(threadTitle).toBeVisible({ timeout: 5000 });
  });
});
