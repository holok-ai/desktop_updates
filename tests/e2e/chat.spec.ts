import { test, expect, type ElectronApplication } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createThread, waitForStreamingComplete } from '../helpers/ui-helpers';

test.describe('E2E: Chat prompt/response', () => {
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

  test('send prompt and receive assistant response', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Already authenticated - no login needed!

    // Create a thread with a simple prompt
    const prompt = `Just say "Okay" ${Date.now()}`;
    await createThread(page, prompt);

    // Wait for user message to appear in the UI
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: 'Just say "Okay"' }),
    ).toBeVisible({ timeout: 10000 });

    // Wait for assistant response to start streaming (message appears)
    await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
      timeout: 60000,
    });

    // Wait for streaming to complete
    await waitForStreamingComplete(page, 120000);
  });
});
