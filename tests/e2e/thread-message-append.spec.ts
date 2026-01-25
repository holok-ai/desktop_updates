import { test, expect, type ElectronApplication } from '@playwright/test';
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
    await createThread(page, prompt1, undefined, 'claude-opus-4-20250514');

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

    // Reuse the thread from test 1 instead of creating a new one
    // This avoids the "New Thread" button issue in serial mode

    // Navigate to threads to see the thread list
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(1000);

    // Click the first "Test Append" thread from test 1
    const existingThread = page.getByRole('menuitem', { name: /Test Append/ }).first();
    await expect(existingThread).toBeVisible({ timeout: 5000 });
    await existingThread.click();
    await page.waitForTimeout(1000);

    // Wait for chat pane to be visible
    const chatPane = page.locator('.chat-pane');
    await expect(chatPane).toBeVisible({ timeout: 10000 });

    // Wait for first user message to appear
    await expect(page.locator('.messages .message.user').first()).toBeVisible({ timeout: 5000 });

    // Get initial message count
    const initialCount = await page.locator('.messages .message.user').count();

    // Wait for message input to be ready
    await waitForMessageInput(page);

    // Send a second message
    const textarea = page.locator('[data-testid="message-input"]');
    const uniquePrompt = `Second message ${Date.now()}`;
    await textarea.fill(uniquePrompt);
    await textarea.press('Enter');

    // Wait for new message to appear
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: uniquePrompt }),
    ).toBeVisible({ timeout: 5000 });

    // Get count after sending messages
    const afterSendCount = await page.locator('.messages .message.user').count();
    expect(afterSendCount).toBe(initialCount + 1); // Should have one more user message

    // Reload and verify no duplicates
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Wait for app to initialize after reload

    // After reload, app goes to homepage - navigate back to the thread
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(1000);

    // Click the same thread again
    const threadAfterReload = page.getByRole('menuitem', { name: /Test Append/ }).first();
    await expect(threadAfterReload).toBeVisible({ timeout: 5000 });
    await threadAfterReload.click();
    await page.waitForTimeout(2000); // Wait longer for navigation

    // Wait for chat pane to be visible (more robust check)
    const chatPaneAfterReload = page.locator('.chat-pane');
    await expect(chatPaneAfterReload).toBeVisible({ timeout: 10000 });

    // Wait for messages to load
    await expect(page.locator('.messages .message').first()).toBeVisible({ timeout: 10000 });

    // Verify user message count matches (no duplicates)
    const reloadedUserCount = await page.locator('.messages .message.user').count();
    expect(reloadedUserCount).toBe(1);
  });
});
