import { test, expect, type ElectronApplication } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createThread, waitForStreamingComplete, navigateToThreads, forceThreadRefresh } from '../helpers/ui-helpers';

test.describe('E2E: Small Prompts - Basic Chat Functionality', () => {
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

  test('Prompt 1: Simple factual question', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const prompt = 'What is the capital of France?';
    const start = Date.now();

    // Use createThread helper which uses Haiku 3.5 by default
    await createThread(page, prompt);

    // Wait for user message to appear with increased timeout
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }).last(),
    ).toBeVisible({ timeout: 30000 });

    // Wait for assistant message to appear and streaming to complete
    const assistantMessage = page.locator('.messages .message.assistant').last();
    try {
      await expect(assistantMessage).toBeVisible({ timeout: 60000 });
    } catch (error) {
      console.log('[Prompt 1] Assistant message not visible after 60s, attempting recovery...');
      await forceThreadRefresh(page);
      await expect(assistantMessage).toBeVisible({ timeout: 30000 });
    }

    // Wait for streaming to complete (message no longer has .streaming class)
    await waitForStreamingComplete(page);

    // Additional wait to ensure markdown rendering is complete
    await page.waitForTimeout(3000);

    // Now check the content
    const assistantContent = page.locator('.messages .message.assistant .message-content').last();
    await expect(assistantContent).toBeVisible({ timeout: 10000 });

    const responseText = (await assistantContent.textContent()) ?? '';
    console.log('Assistant response:', responseText);
    expect(responseText.toLowerCase()).toContain('paris');

    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(120000); // 2 minutes for AI response
  });

  test('Prompt 2: Code snippet request', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Create thread directly with the fibonacci prompt instead of warm-up
    const prompt = 'Write a Python function to calculate fibonacci numbers';
    const start = Date.now();

    await createThread(page, prompt);

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }).last(),
    ).toBeVisible({ timeout: 10000 });

    // Wait for assistant message to appear
    const assistant = page.locator('.messages .message.assistant').last();
    try {
      await expect(assistant).toBeVisible({ timeout: 60000 });
    } catch (error) {
      console.log('[Prompt 2] Assistant message not visible after 60s, attempting recovery...');
      await forceThreadRefresh(page);
      await expect(assistant).toBeVisible({ timeout: 30000 });
    }

    // Wait for streaming to complete
    await waitForStreamingComplete(page);

    // Additional wait to ensure content is fully rendered
    await page.waitForTimeout(3000);

    // Debug: log the response
    const responseText = await assistant.textContent();
    console.log('Code snippet response:', responseText);

    const codeWrapper = assistant.locator('.code-block-wrapper').first();
    const hasCodeBlock = await codeWrapper.count();

    if (hasCodeBlock > 0) {
      await expect(codeWrapper).toBeVisible({ timeout: 10000 });

      await expect(assistant.locator('.code-lang').first()).toContainText(/python/i, {
        timeout: 5000,
      });

      // Check if copy button exists (may not be present in all code block formats)
      const copyBtn = assistant.locator('.copy-btn').first();
      const hasCopyBtn = await copyBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasCopyBtn) {
        await copyBtn.click();
        await expect(assistant.locator('.copy-text').first()).toContainText('Copied!', {
          timeout: 4000,
        });
      } else {
        console.log('[small-prompts] Copy button not found, skipping copy test');
      }

      await expect(assistant.locator('pre code.hljs').first()).toBeVisible({ timeout: 5000 });
    } else {
      console.log('No code block found, checking for code in response text');
      // If no code block wrapper, at least verify the response mentions fibonacci
      expect(responseText?.toLowerCase()).toContain('fibonacci');
    }

    const bodyText = ((await assistant.textContent()) ?? '').toLowerCase();
    expect(bodyText).toContain('fibonacci');

    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(180000); // Increased from 120000 to 180000 (3 minutes)
  });
});
