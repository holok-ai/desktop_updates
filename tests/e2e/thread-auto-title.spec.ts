import { test, expect, type ElectronApplication } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createThread, waitForStreamingComplete, waitForMessageInput } from '../helpers/ui-helpers';

test.describe('E2E: Thread Auto-Title Generation', () => {
  let app: ElectronApplication | undefined;
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('should auto-generate title from initial prompt', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Create thread with initial prompt - title auto-generated from prompt
    const prompt = 'Test prompt. Reply shortly';
    await createThread(page, prompt);

    // Wait for message input to be ready (ensures thread is fully loaded)
    await waitForMessageInput(page);

    // Wait for user message to appear (createThread should handle this, but verify)
    const userMessage = page.locator('.messages .message.user .message-content', { hasText: prompt });
    await expect(userMessage).toBeVisible({ timeout: 10000 });

    // Ensure messages container is visible and has content
    const messagesContainer = page.locator('.messages');
    await expect(messagesContainer).toBeVisible({ timeout: 10000 });
    
    // Wait a bit for the assistant response to start
    await page.waitForTimeout(2000);

    // Wait for assistant message to start appearing
    // First check if streaming message exists
    const streamingMessage = page.locator('.messages .message.assistant.streaming');
    const assistantMessage = page.locator('.messages .message.assistant').last();
    
    // Check if streaming message is visible (response has started)
    let isStreaming = await streamingMessage.isVisible({ timeout: 30000 }).catch(() => false);
    
    // If no streaming message, check if there's already a completed assistant message
    if (!isStreaming) {
      const hasAssistantMessage = await assistantMessage.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasAssistantMessage) {
        // No assistant message yet, wait a bit more and check again
        console.log('[thread-auto-title] No assistant message yet, waiting...');
        await page.waitForTimeout(3000);
        isStreaming = await streamingMessage.isVisible({ timeout: 20000 }).catch(() => false);
      }
    }
    
    // Wait for assistant message to be visible
    await expect(assistantMessage).toBeVisible({ timeout: 60000 });

    // Wait for streaming to complete
    await waitForStreamingComplete(page);

    // Wait for title generation (happens after response completes)
    await page.waitForTimeout(5000);

    // Verify title in chat header - should contain text from prompt
    const chatHeader = page.locator('.chat-header h2');
    await expect(chatHeader).toBeVisible({ timeout: 5000 });
    const titleText = await chatHeader.textContent();

    expect(titleText).toBeTruthy();
    expect(titleText).not.toBe('New Thread');
    expect(titleText?.trim().length).toBeGreaterThan(5);

    console.log('✓ Generated title in chat header:', titleText);
  });
});
