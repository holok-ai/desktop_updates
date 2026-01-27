import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { createThread, waitForStreamingComplete } from '../helpers/ui-helpers';
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

    const promptText = 'E2E Model Selection Test - Just respond with OK';
    const selectedModelId = 'claude-opus-4-20250514';

    // Use createThread helper which handles all edge cases reliably
    await createThread(page, promptText, undefined, selectedModelId);

    // Wait for chat view to be visible
    const chatPane = page.locator('.chat-pane');
    await expect(chatPane).toBeVisible({ timeout: 15000 });

    // Wait for user message to appear
    const userMessage = page.locator('.messages .message.user .message-content', {
      hasText: promptText,
    });
    await expect(userMessage).toBeVisible({ timeout: 10000 });

    // Wait for response to start
    await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
      timeout: 30000,
    });

    // Wait for streaming to complete
    await waitForStreamingComplete(page);

    // Verify model persisted by checking thread metadata via IPC
    const threadMetadata = await page.evaluate(async (prompt) => {
      const threads = await (window as any).electronAPI.thread.getAll();
      // Find thread that was just created (most recent with matching title pattern)
      const thread = threads.find((t: any) => t.title && t.title.includes('E2E Model Selection'));
      return thread?.metadata;
    }, promptText);

    expect(threadMetadata).toBeDefined();

    // Model should be stored in metadata
    expect(threadMetadata.modelId).toBeDefined();
    console.log('Thread metadata:', threadMetadata);
  });
});
