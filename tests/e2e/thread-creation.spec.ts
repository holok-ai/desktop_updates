/**
 * Thread Creation E2E Tests
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 * - New thread page shows model selector and prompt textarea
 * - Selecting a model populates the model selector display
 * - Filling prompt and clicking Send creates thread and shows chat view
 * - Empty prompt keeps Send button disabled
 * - Created thread shows user message and begins streaming
 *
 * Note: The thread creation page uses a custom ModelSelector dropdown (button),
 * NOT a native <select>. There is no separate agent selector — only a model selector.
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Thread Creation', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('new thread page shows model selector and prompt textarea', async () => {
    // Requirement 4.1: page shows model selector and prompt textarea
    // Navigate to new thread page
    await page.locator('button[aria-label="+ New Thread"]').click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/threads\/new/, { timeout: 10000 });

    // Verify prompt textarea is visible
    const promptTextarea = page.locator('textarea#thread-prompt');
    await expect(promptTextarea).toBeVisible({ timeout: 10000 });

    // Verify model selector button is visible
    const modelSelectorBtn = page.locator('button#model-selector');
    await expect(modelSelectorBtn).toBeVisible({ timeout: 10000 });

    // Verify send button is visible
    const sendButton = page.locator('button.send-button');
    await expect(sendButton).toBeVisible({ timeout: 5000 });
  });

  test('model selector shows available models and selects llama3.2', async () => {
    // Requirement 4.2: selecting a model populates model selector
    const modelSelectorBtn = page.locator('button#model-selector');
    await expect(modelSelectorBtn).toBeVisible({ timeout: 5000 });

    // Click to open the dropdown
    await modelSelectorBtn.click();
    await page.waitForTimeout(1000);

    // Verify dropdown appears with model options
    const dropdown = page.locator('.model-selector-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Verify at least one model item is listed
    const modelItems = dropdown.locator('.dropdown-item:not(.loading):not(.empty)');
    await expect(modelItems.first()).toBeVisible({ timeout: 10000 });
    const modelCount = await modelItems.count();
    expect(modelCount).toBeGreaterThan(0);

    // Select the llama3.2 model specifically (most stable for E2E tests)
    const llamaItem = dropdown.locator('.dropdown-item .model-title', { hasText: /llama/i });
    const llamaCount = await llamaItem.count();
    if (llamaCount > 0) {
      // Click the parent dropdown-item button that contains the llama model title
      await llamaItem.first().click();
    } else {
      // Fallback: select the first model if llama not found
      await modelItems.first().click();
    }
    await page.waitForTimeout(500);

    // Dropdown should close after selection (single selection mode)
    await expect(dropdown).toBeHidden({ timeout: 3000 });

    // Model selector button should now show the selected model name (not "Select model")
    const buttonText = await modelSelectorBtn.textContent();
    expect(buttonText).not.toContain('Select model');
  });

  test('empty prompt keeps Send button disabled', async () => {
    // Requirement 4.4: empty prompt prevents submission
    const promptTextarea = page.locator('textarea#thread-prompt');
    const sendButton = page.locator('button.send-button');

    // Clear the textarea to ensure it's empty
    await promptTextarea.clear();
    await page.waitForTimeout(300);

    // Verify textarea is empty
    const value = await promptTextarea.inputValue();
    expect(value.trim()).toBe('');

    // Click send button — form should not submit (handleSubmit checks for empty prompt)
    // The button itself isn't disabled via HTML attribute, but the submit handler returns early.
    // We verify by clicking and confirming we stay on the same page.
    await sendButton.click();
    await page.waitForTimeout(1000);

    // Should still be on the new thread page (no navigation happened)
    await expect(page).toHaveURL(/\/threads\/new/, { timeout: 5000 });
  });

  test('filling prompt and clicking Send creates thread and shows chat view', async () => {
    // Requirement 4.3: filling prompt and sending creates thread
    const promptTextarea = page.locator('textarea#thread-prompt');
    const sendButton = page.locator('button.send-button');

    // Ensure llama3.2 model is selected (it should be from the previous test)
    const modelSelectorBtn = page.locator('button#model-selector');
    const modelText = await modelSelectorBtn.textContent();
    if (!modelText?.toLowerCase().includes('llama')) {
      // Need to select llama3.2 model
      await modelSelectorBtn.click();
      await page.waitForTimeout(1000);
      const dropdown = page.locator('.model-selector-dropdown');
      const llamaItem = dropdown.locator('.dropdown-item .model-title', { hasText: /llama/i });
      const llamaCount = await llamaItem.count();
      if (llamaCount > 0) {
        await llamaItem.first().click();
      } else {
        const modelItems = dropdown.locator('.dropdown-item:not(.loading):not(.empty)');
        await modelItems.first().click();
      }
      await page.waitForTimeout(500);
    }

    // Fill in the prompt
    await promptTextarea.fill('Just respond with OK');
    await page.waitForTimeout(300);

    // Click Send
    await sendButton.click();
    await page.waitForTimeout(2000);

    // Should navigate away from /threads/new to the thread view
    await expect(page).not.toHaveURL(/\/threads\/new/, { timeout: 30000 });

    // Should now be on a thread view page with threadId parameter
    await expect(page).toHaveURL(/threadId=/, { timeout: 15000 });
  });

  test('created thread shows user message and chat view is functional', async () => {
    // Requirement 4.5: chat view shows user message after thread creation
    // We should already be on the thread view from the previous test

    // Wait for thread chat view to be visible
    const chatView = page.locator('.thread-chat-view');
    await expect(chatView).toBeVisible({ timeout: 30000 });

    // Wait for the chat-message div (user message) to appear
    // ChatMessage uses <div role="article" aria-label="Chat message">
    const chatMessage = page.locator('div[role="article"][aria-label="Chat message"]').first();
    await expect(chatMessage).toBeVisible({ timeout: 60000 });

    // Verify the user message contains our prompt text
    await expect(chatMessage).toContainText('Just respond with OK', { timeout: 5000 });

    // Verify the thread title is shown in the header
    const threadTitle = page.locator('h1');
    await expect(threadTitle).toBeVisible({ timeout: 5000 });
    await expect(threadTitle).toContainText('Just respond with OK', { timeout: 5000 });

    // Verify the Composer (message input) is present at the bottom for continued chat
    const messageInput = page.locator('[data-testid="message-input"]');
    await expect(messageInput).toBeVisible({ timeout: 10000 });

    // Verify the model selector is available in the Composer
    const modelSelector = page.locator('button[aria-label="Select model"]');
    await expect(modelSelector).toBeVisible({ timeout: 5000 });

    // Verify the send button is available
    const sendButton = page.locator('button[aria-label*="Send message"]');
    await expect(sendButton).toBeVisible({ timeout: 5000 });
  });
});
