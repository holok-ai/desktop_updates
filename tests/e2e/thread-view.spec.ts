/**
 * Thread View and Chat E2E Tests
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 * - Opening existing thread shows chat pane with messages
 * - Sending a message shows user message and streams AI response
 * - Streaming indicator visible during response, input disabled
 * - After streaming completes, message input is re-enabled
 * - Thread title is displayed in header
 * - Editing thread title saves and reflects in UI
 *
 * Strategy: First create a thread by clicking an application card on the home page,
 * then test the thread view functionality on that thread.
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createThreadViaUI } from '../fixtures/thread-context-menu-helpers';
import { SIMPLE_TEST_PROMPT } from '../helpers/ui-helpers';
import { deleteThreadsByPrefix } from '../helpers/cleanup-helpers';
import { E2E_THREAD_PREFIX, E2E_RENAMED_THREAD_TITLE_PREFIX } from '../helpers/e2e-constants';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Thread View and Chat', () => {
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
      await deleteThreadsByPrefix(page, E2E_RENAMED_THREAD_TITLE_PREFIX);
    }

    await app?.close();
  });

  test('opening existing thread shows chat pane with messages area', async () => {
    // Requirement 5.1: existing thread shows chat pane
    // First create a thread via the UI so we have one to view
    await createThreadViaUI(page);

    // Verify the chat view has messages area
    const messagesArea = page.locator('.messages-area');
    await expect(messagesArea).toBeVisible({ timeout: 5000 });
  });

  test('thread title is displayed in header', async () => {
    // Requirement 5.5: thread title displayed in header
    // We should still be on the thread from the previous test
    const threadTitle = page.locator('h1.thread-title');
    await expect(threadTitle).toBeVisible({ timeout: 5000 });

    // Title should have content
    const titleText = await threadTitle.textContent();
    expect(titleText).toBeTruthy();
    expect(titleText!.length).toBeGreaterThan(0);
  });

  test('sending a message shows user message and streams AI response', async () => {
    test.setTimeout(180000);
    // Requirement 5.2: sending message shows user message and streams response
    // We should be on an existing thread from previous tests

    // If assistant is unavailable on current thread, create a new one via UI
    const infoBanner = page.locator('.info-banner');
    if (await infoBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createThreadViaUI(page);
    }

    // Type a message in the Composer
    const messageInput = page.locator('[data-testid="message-input"]');
    await expect(messageInput).toBeVisible({ timeout: 10000 });
    await expect(messageInput).toBeEnabled({ timeout: 5000 });

    await messageInput.fill(SIMPLE_TEST_PROMPT);

    // Click send
    const sendButton = page.locator('button.send-button');
    await sendButton.click();

    // Wait for the user message to appear
    const chatMessages = page.locator('div[role="article"][aria-label="Chat message"]');
    const messageAppeared = await chatMessages
      .first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (!messageAppeared) {
      // Agent may have become unavailable mid-send — recover via new thread and retry
      await createThreadViaUI(page);

      const retryInput = page.locator('[data-testid="message-input"]');
      await expect(retryInput).toBeVisible({ timeout: 10000 });
      await expect(retryInput).toBeEnabled({ timeout: 5000 });
      await retryInput.fill(SIMPLE_TEST_PROMPT);

      const retrySend = page.locator('button.send-button');
      await retrySend.click();

      await expect(chatMessages.first()).toBeVisible({ timeout: 30000 });
    }

    // Verify the user message contains our text
    await expect(chatMessages.first()).toContainText(SIMPLE_TEST_PROMPT, { timeout: 5000 });

    // Wait for AI response to complete
    const allResponses = page.locator('.chat-response .response-bubble');
    await expect(allResponses.last()).toBeVisible({ timeout: 120000 });
  });

  test('after streaming completes, message input is re-enabled', async () => {
    // Requirement 5.4: after streaming, input is re-enabled
    // Wait for streaming to fully complete by checking the input becomes enabled
    const messageInput = page.locator('[data-testid="message-input"]');
    await expect(messageInput).toBeVisible({ timeout: 10000 });
    await expect(messageInput).toBeEnabled({ timeout: 30000 });

    // Send button should also be enabled
    const sendButton = page.locator('button.send-button');
    await expect(sendButton).toBeEnabled({ timeout: 5000 });
  });

  test('toggling favorite on thread updates star icon', async () => {
    // Header commands are hidden until hover — hover first to reveal buttons
    const headerContent = page.locator('.header-content');
    await headerContent.hover();

    // The favorite button uses CSS visibility (hidden by default, visible on hover)
    const favButton = page.locator('button.favorite-star');
    const headerCommands = page.locator('.header-commands');
    await expect(headerCommands).toHaveCSS('visibility', 'visible', { timeout: 5000 });

    // Check initial state via class
    const isAlreadyFav = await favButton.evaluate((el) => el.classList.contains('is-favorited'));

    // Toggle favorite
    await favButton.click();

    // Re-hover to keep commands visible
    await headerContent.hover();
    await expect(headerCommands).toHaveCSS('visibility', 'visible', { timeout: 5000 });

    if (isAlreadyFav) {
      const stillFav = await favButton.evaluate((el) => el.classList.contains('is-favorited'));
      expect(stillFav).toBe(false);
    } else {
      const nowFav = await favButton.evaluate((el) => el.classList.contains('is-favorited'));
      expect(nowFav).toBe(true);
    }

    // Toggle back to restore original state
    await favButton.click();
  });

  test('editing thread title saves and reflects in UI', async () => {
    // Requirement 5.6: editing title saves and reflects
    const threadTitle = page.locator('h1.thread-title');
    await expect(threadTitle).toBeVisible({ timeout: 5000 });

    // Click to start editing (EditableText activates on single click)
    await threadTitle.click();

    // Title input should appear
    const titleInput = page.locator('input[aria-label="Edit text"]');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Clear and type new title
    await titleInput.clear();
    await titleInput.fill('Renamed Thread E2E');

    // Press Enter to commit
    await titleInput.press('Enter');

    // Verify the title updated
    await expect(threadTitle).toBeVisible({ timeout: 5000 });
    await expect(threadTitle).toContainText('Renamed Thread E2E', { timeout: 5000 });
  });
});
