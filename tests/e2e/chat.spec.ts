import { test, expect, type ElectronApplication } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import {
  createThread,
  waitForStreamingComplete,
  SIMPLE_TEST_PROMPT,
  forceThreadRefresh,
} from '../helpers/ui-helpers';

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
    await createThread(page, SIMPLE_TEST_PROMPT);

    // Wait for user message to appear in the UI
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: SIMPLE_TEST_PROMPT }),
    ).toBeVisible({ timeout: 10000 });

    // Wait for assistant response to start streaming (message appears)
    const assistantContent = page.locator('.messages .message.assistant .message-content');
    try {
      await expect(assistantContent).toBeVisible({
        timeout: 60000,
      });
    } catch (error) {
      console.log('[Chat] Assistant message not visible after 60s, attempting recovery...');
      await forceThreadRefresh(page);
      await expect(assistantContent).toBeVisible({ timeout: 30000 });
    }

    // Wait for streaming to complete
    await waitForStreamingComplete(page, 120000);
  });
});
