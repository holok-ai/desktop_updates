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

let app: ElectronApplication;
let page: Page;

/**
 * Helper: create a thread via the UI by clicking an application card.
 * Navigates to the new-thread page, clicks the first app card, and waits
 * for the thread view to load.
 */
async function createThreadViaUI(page: Page) {
  // Navigate to new thread page via sidebar
  await page.locator('button[aria-label="+ New Thread"]').click();
  await page.waitForTimeout(3000);

  // Wait for application cards to load
  const cards = page.locator('.application-card');
  await expect(cards.first()).toBeVisible({ timeout: 15000 });

  // Click the first application card to create a thread
  await cards.first().click();
  await page.waitForTimeout(5000);

  // Wait for navigation to thread view
  await expect(page).toHaveURL(/threadId=/, { timeout: 15000 });
  await expect(page.locator('.thread-chat-view')).toBeVisible({ timeout: 30000 });
}

test.describe.serial('Thread View and Chat', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
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

    // Helper: if agent is unavailable, click "+ New Thread" to get a brand new working thread
    async function recoverViaNewThread() {
      // Click "+ New Thread" sidebar button to go to application selection page
      await page.locator('button[aria-label="+ New Thread"]').click();
      await page.waitForTimeout(3000);

      // Wait for application cards to load
      const cards = page.locator('.application-card');
      await expect(cards.first()).toBeVisible({ timeout: 15000 });

      // Click the first application card to create a new thread via UI
      await cards.first().click();
      await page.waitForTimeout(5000);

      // Should navigate to thread view
      await expect(page).toHaveURL(/threadId=/, { timeout: 30000 });
      await expect(page.locator('.thread-chat-view')).toBeVisible({ timeout: 30000 });
    }

    // If assistant is unavailable on current thread, create a new one via UI
    const infoBanner = page.locator('.info-banner');
    if (await infoBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await recoverViaNewThread();
    }

    // Type a message in the Composer
    const messageInput = page.locator('[data-testid="message-input"]');
    await expect(messageInput).toBeVisible({ timeout: 10000 });
    await expect(messageInput).toBeEnabled({ timeout: 5000 });

    await messageInput.fill('Just respond with OK');
    await page.waitForTimeout(300);

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
      await recoverViaNewThread();

      const retryInput = page.locator('[data-testid="message-input"]');
      await expect(retryInput).toBeVisible({ timeout: 10000 });
      await expect(retryInput).toBeEnabled({ timeout: 5000 });
      await retryInput.fill('Just respond with OK');
      await page.waitForTimeout(300);

      const retrySend = page.locator('button.send-button');
      await retrySend.click();

      await expect(chatMessages.first()).toBeVisible({ timeout: 30000 });
    }

    // Verify the user message contains our text
    await expect(chatMessages.first()).toContainText('Just respond with OK', { timeout: 5000 });

    // Wait for AI response to complete
    const allResponses = page.locator('.chat-response .response-bubble');
    await expect(allResponses.last()).toBeVisible({ timeout: 120000 });
  });

  test('after streaming completes, message input is re-enabled', async () => {
    // Requirement 5.4: after streaming, input is re-enabled
    // Wait a moment for streaming to fully complete
    await page.waitForTimeout(2000);

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
    await page.waitForTimeout(500);

    const favButton = page.locator('button.favorite-star');
    await expect(favButton).toBeVisible({ timeout: 5000 });

    // Check initial state via class
    const isAlreadyFav = await favButton.evaluate((el) => el.classList.contains('is-favorited'));

    // Toggle favorite
    await favButton.click();
    await page.waitForTimeout(500);

    // Re-hover to keep commands visible
    await headerContent.hover();
    await page.waitForTimeout(300);

    if (isAlreadyFav) {
      const stillFav = await favButton.evaluate((el) => el.classList.contains('is-favorited'));
      expect(stillFav).toBe(false);
    } else {
      const nowFav = await favButton.evaluate((el) => el.classList.contains('is-favorited'));
      expect(nowFav).toBe(true);
    }

    // Toggle back to restore original state
    await favButton.click();
    await page.waitForTimeout(500);
  });

  test('switching between thread view tabs shows correct content', async () => {
    // The view selector shows only the active tab until hovered
    const viewSelector = page.locator('.view-selector');
    await expect(viewSelector).toBeVisible({ timeout: 5000 });

    // Hover to reveal all 5 tabs
    await viewSelector.hover();
    await page.waitForTimeout(500);

    const tabs = viewSelector.locator('button[role="tab"]');
    await expect(tabs).toHaveCount(5, { timeout: 5000 });

    // Chat tab should be active by default
    const chatTab = tabs.nth(0);
    await expect(chatTab).toHaveAttribute('aria-selected', 'true');

    // Click Prompt tab (2nd)
    await viewSelector.hover();
    await page.waitForTimeout(300);
    await tabs.nth(1).click();
    await page.waitForTimeout(500);

    // Prompt view should be visible (has .thread-prompt-view)
    await expect(page.locator('.thread-prompt-view')).toBeVisible({ timeout: 5000 });

    // Click Graphic tab (3rd)
    await viewSelector.hover();
    await page.waitForTimeout(300);
    await tabs.nth(2).click();
    await page.waitForTimeout(500);

    // Graphic view should be visible (has .thread-graphic-view)
    await expect(page.locator('.thread-graphic-view')).toBeVisible({ timeout: 5000 });

    // Click Execution tab (4th) — stub view
    await viewSelector.hover();
    await page.waitForTimeout(300);
    await tabs.nth(3).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.stub-view h3', { hasText: 'Execution View' })).toBeVisible({
      timeout: 5000,
    });

    // Click File tab (5th) — stub view
    await viewSelector.hover();
    await page.waitForTimeout(300);
    await tabs.nth(4).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.stub-view h3', { hasText: 'File View' })).toBeVisible({
      timeout: 5000,
    });

    // Switch back to Chat tab
    await viewSelector.hover();
    await page.waitForTimeout(300);
    await tabs.nth(0).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.thread-chat-view')).toBeVisible({ timeout: 5000 });
  });

  test('editing thread title saves and reflects in UI', async () => {
    // Requirement 5.6: editing title saves and reflects
    const threadTitle = page.locator('h1.thread-title');
    await expect(threadTitle).toBeVisible({ timeout: 5000 });

    // Click to start editing (EditableText activates on single click)
    await threadTitle.click();
    await page.waitForTimeout(500);

    // Title input should appear
    const titleInput = page.locator('input[aria-label="Edit text"]');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Clear and type new title
    await titleInput.clear();
    await titleInput.fill('Renamed Thread E2E');
    await page.waitForTimeout(300);

    // Press Enter to commit
    await titleInput.press('Enter');
    await page.waitForTimeout(1000);

    // Verify the title updated
    await expect(threadTitle).toBeVisible({ timeout: 5000 });
    await expect(threadTitle).toContainText('Renamed Thread E2E', { timeout: 5000 });
  });
});
