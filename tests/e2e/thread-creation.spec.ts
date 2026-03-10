/**
 * Thread Creation E2E Tests
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 * - New thread page (ApplicationThread) shows available application cards
 * - Application cards display title, description, and chat action
 * - Clicking an application card creates a thread and navigates to chat view
 * - Created thread shows chat view with messages area
 * - Chat view has a functional Composer for continued conversation
 *
 * Note: The thread creation flow is:
 *   1. Navigate to /threads/applications (or /) — shows ApplicationThread
 *   2. Click an application card
 *   3. Thread is created automatically and user is navigated to /threads/view?threadId=xxx
 *   There is no separate form with textarea/model-selector for thread creation.
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createThreadViaUI } from '../fixtures/thread-context-menu-helpers';
import { deleteThreadsByPrefix } from '../helpers/cleanup-helpers';
import { E2E_THREAD_PREFIX } from '../helpers/e2e-constants';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Thread Creation', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    // Wait for the app shell to be fully rendered after launch
    await expect(page.locator('.app-layout')).toBeVisible({ timeout: 10000 });
  });

  test.afterAll(async () => {
    if (page && !page.isClosed()) {
      await deleteThreadsByPrefix(page, E2E_THREAD_PREFIX);
    }

    await app?.close();
  });

  test('new thread page shows available application cards', async () => {
    // Requirement 4.1: page shows available applications to start a thread
    // Navigate to new thread page via sidebar
    await page.locator('button[aria-label="+ New Thread"]').click();
    await expect(page).toHaveURL(/\/threads\/applications/, { timeout: 10000 });

    // Verify the ApplicationThread page is visible
    const appPage = page.locator('.application-thread-page');
    await expect(appPage).toBeVisible({ timeout: 15000 });

    // Verify the "Let's chat" header
    const header = appPage.locator('.page-header h2');
    await expect(header).toHaveText("Let's chat");

    // Verify applications container is visible
    const container = page.locator('.applications-container');
    await expect(container).toBeVisible({ timeout: 10000 });

    // Wait for applications to finish loading (grid or empty state)
    const cards = page.locator('.application-card');
    await expect(cards.first()).toBeVisible({ timeout: 20000 });
  });

  test('application cards display title, description, and chat action', async () => {
    // Requirement 4.2: application cards show relevant info
    const cards = page.locator('.application-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Verify first card structure
    const firstCard = cards.first();
    await expect(firstCard.locator('.app-title')).toBeVisible({ timeout: 5000 });
    await expect(firstCard.locator('.app-provider')).toBeVisible({ timeout: 5000 });
    await expect(firstCard.locator('.card-footer')).toContainText('Chat');
  });

  test('clicking an application card creates thread and shows chat view', async () => {
    // Requirement 4.3: clicking a card creates thread and navigates to chat
    // Navigate back to threads first, then use the robust createThreadViaUI helper
    // which handles retries and token refresh
    await page.locator('button[aria-label="Threads"]').click();
    await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });

    await createThreadViaUI(page);

    // Should now be on a thread view page with threadId parameter
    await expect(page).toHaveURL(/threadId=/, { timeout: 15000 });
  });

  test('created thread shows chat view with messages area', async () => {
    // Requirement 4.5: chat view is functional after thread creation
    // We should already be on the thread view from the previous test

    // Wait for thread chat view to be visible
    const chatView = page.locator('.thread-chat-view');
    await expect(chatView).toBeVisible({ timeout: 30000 });

    // Verify the messages area is present
    const messagesArea = page.locator('.messages-area');
    await expect(messagesArea).toBeVisible({ timeout: 10000 });

    // Verify the thread title is shown in the header
    const threadTitle = page.locator('h1.thread-title');
    await expect(threadTitle).toBeVisible({ timeout: 5000 });

    // Verify the Composer (message input) is present at the bottom for continued chat
    const messageInput = page.locator('[data-testid="message-input"]');
    await expect(messageInput).toBeVisible({ timeout: 10000 });

    // Verify the send button is available in the Composer
    const sendButton = page.locator('button.send-button');
    await expect(sendButton).toBeVisible({ timeout: 5000 });
  });
});
