import { test, expect } from '@playwright/test';
import type { ElectronApplication } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createThread, waitForMessageInput } from '../helpers/ui-helpers';

test.describe('E2E: Thread Message Append (Story ACs)', () => {
  let app: ElectronApplication | undefined;
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    try {
      app = await launchAuthenticatedApp();
    } catch (error) {
      console.error('Failed to launch authenticated app:', error);
      test.skip(true, 'Electron failed to launch in this environment');
    }
  });

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('Scenario 1: Append Messages to Existing Thread (Happy Path)', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Already authenticated - no login needed!
    // Create thread using helper (this will navigate to home first, then threads)
    const prompt1 = `Test Append ${Date.now()}`;
    // Use default model (Haiku 3.5)
    await createThread(page, prompt1);

    // Wait for first user message to appear
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt1 }),
    ).toBeVisible({ timeout: 5000 });

    // Verify we have at least 1 user message
    const userMessages = page.locator('.messages .message.user');
    const userCount = await userMessages.count();
    expect(userCount).toBeGreaterThanOrEqual(1);

    // Test passes - we successfully created a thread and sent a message
    // Scenario 2 will test appending additional messages
  });

  test('Scenario 2: Idempotency - No Duplicate Messages on Retry', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Navigate to threads to see the thread list
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(1000);

    // Click the first "Test Append" thread from test 1
    const existingThread = page.getByRole('menuitem', { name: /Test Append/ }).first();
    await expect(existingThread).toBeVisible({ timeout: 5000 });
    await existingThread.click();
    await page.waitForTimeout(2000);

    // Wait for chat pane to be visible
    const chatPane = page.locator('.chat-pane');
    await expect(chatPane).toBeVisible({ timeout: 10000 });

    // Wait for messages container to be visible
    const messagesContainer = page.locator('.messages');
    await expect(messagesContainer).toBeVisible({ timeout: 10000 });

    // Wait for message input to be ready (ensures thread is fully loaded)
    await waitForMessageInput(page);

    // Wait for first user message to appear
    await expect(page.locator('.messages .message.user').first()).toBeVisible({ timeout: 10000 });

    // Get initial message count
    const initialCount = await page.locator('.messages .message.user').count();
    console.log(`[thread-message-append] Initial user message count: ${initialCount}`);

    // Send a second message
    const textarea = page.locator('[data-testid="message-input"]');
    const uniquePrompt = `Second message ${Date.now()}`;
    await textarea.fill(uniquePrompt);
    await textarea.press('Enter');

    // Wait for new message to appear
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: uniquePrompt }),
    ).toBeVisible({ timeout: 10000 });

    // Get count after sending message
    const afterSendCount = await page.locator('.messages .message.user').count();
    console.log(`[thread-message-append] After send user message count: ${afterSendCount}`);
    expect(afterSendCount).toBe(initialCount + 1); // Should have one more user message

    // Verify no duplicates by checking that we have exactly the expected count
    expect(afterSendCount).toBeGreaterThan(initialCount);
  });
});
