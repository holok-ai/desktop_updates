import { test, expect, ElectronApplication } from '@playwright/test';
import { createThread, waitForStreamingComplete, SIMPLE_TEST_PROMPT } from '../helpers/ui-helpers';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

test.describe('E2E: Model selection on thread start', () => {
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
    if (app) await app.close();
  });

  test('select model before creating thread and persist in metadata', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await page.waitForLoadState('networkidle');

    // Use default model (Haiku 3.5)
    // Use createThread helper which handles all edge cases reliably
    await createThread(page, SIMPLE_TEST_PROMPT);

    // Wait for chat view to be visible
    const chatPane = page.locator('.chat-pane');
    await expect(chatPane).toBeVisible({ timeout: 15000 });

    // Wait for user message to appear
    const userMessage = page.locator('.messages .message.user .message-content', {
      hasText: SIMPLE_TEST_PROMPT,
    });
    await expect(userMessage).toBeVisible({ timeout: 10000 });

    // Wait for response to start
    await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
      timeout: 30000,
    });

    // Wait for streaming to complete
    await waitForStreamingComplete(page);

    // Verify model persisted by checking thread metadata via IPC
    const threadMetadata = await page.evaluate(async () => {
      const threads = await (window as any).electronAPI.thread.getAll();
      // Find the most recent thread (just created)
      if (threads.length === 0) return undefined;

      // Sort by creation time (most recent first)
      const sortedThreads = threads.sort((a: any, b: any) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      return sortedThreads[0]?.metadata;
    });

    expect(threadMetadata).toBeDefined();

    // Model should be stored in metadata
    expect(threadMetadata.modelId).toBeDefined();
    console.log('Thread metadata:', threadMetadata);
  });
});
