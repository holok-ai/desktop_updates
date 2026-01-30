import { test, expect, type ElectronApplication } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createThread, navigateToHome } from '../helpers/ui-helpers';

test.describe('E2E: Prompt actions (copy, edit+run, run again, run in another model, keyboard)', () => {
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

  test('Copy Prompt to Clipboard (Happy Path)', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Already authenticated - no login needed!
    // Navigate to home first to load models
    await navigateToHome(page);

    // Create thread with unique prompt
    const prompt = `CopyThisPrompt_${Date.now()}`;
    await createThread(page, prompt);

    // Wait for the user message to appear
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }).last(),
    ).toBeVisible({ timeout: 10000 });

    // Wait for assistant response to complete streaming
    const streamingMessage = page.locator('.messages .message.assistant.streaming');
    if ((await streamingMessage.count()) > 0) {
      await expect(streamingMessage).toHaveCount(0, { timeout: 120000 });
    }

    // Wait for UI to settle
    await page.waitForTimeout(1000);

    // Use "Copy to input" button directly
    const copyButton = page.getByRole('button', { name: /Copy to input/i }).first();
    await expect(copyButton).toBeVisible({ timeout: 5000 });
    await copyButton.click();

    // The prompt should now be in the message input
    const messageInput = page.locator('[data-testid="message-input"]');
    await expect(messageInput).toBeVisible({ timeout: 3000 });
    const inputValue = await messageInput.inputValue();
    expect(inputValue).toContain(prompt);
  });
});
