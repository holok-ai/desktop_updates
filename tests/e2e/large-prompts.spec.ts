import { test, expect, type ElectronApplication, Page } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { createThread, waitForStreamingComplete, navigateToThreads } from '../helpers/ui-helpers';

async function waitForMessageInput(page: Page): Promise<void> {
  const input = page.locator('[data-testid="message-input"]');
  await expect(input).toBeVisible({ timeout: 60000 });

  // Wait for streaming to complete if there is any
  try {
    const streamingMessage = page.locator('.message.assistant.streaming');
    const isStreaming = await streamingMessage.isVisible({ timeout: 2000 }).catch(() => false);
    if (isStreaming) {
      await expect(streamingMessage).toBeHidden({ timeout: 120000 });
    }
  } catch {
    // No streaming, continue
  }

  // Wait for input to be enabled
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="message-input"]') as HTMLTextAreaElement;
      return el && !el.disabled;
    },
    undefined,
    { timeout: 120000 },
  );
}

test.describe('Large Prompts - Long-form Content Handling', () => {
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

  test('Comprehensive technical explanation', async () => {
    test.setTimeout(180000);
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const prompt = `Explain how the React Virtual DOM works in detail, including the reconciliation algorithm,
      the diffing process, fiber architecture, and how it compares to the actual DOM. Include code
      examples showing how updates propagate through the component tree, how React batches updates
      for performance, and the role of keys in list rendering. Also explain the trade-offs between
      Virtual DOM and direct DOM manipulation, and how React 18's concurrent features affect this
      process. Provide examples of common performance pitfalls and how to optimize React applications.`;

    // Use Haiku 3.5 for faster, cost-effective large responses
    await createThread(page, prompt, undefined, 'claude-3-5-haiku-20241022');

    await expect(
      page.locator('.messages .message.user .message-content', {
        hasText: prompt.substring(0, 50),
      }),
    ).toBeVisible({
      timeout: 10000,
    });

    const streamingMsg = page.locator('.message.assistant.streaming');
    let sawStreaming = false;
    try {
      await expect(streamingMsg).toBeVisible({ timeout: 30000 });
      sawStreaming = true;
    } catch {
      // Some providers may not expose an explicit streaming message element; fall back to final check
      sawStreaming = false;
    }

    if (sawStreaming) {
      let previousLength = 0;
      const streamingChecks = 5;
      const checkInterval = 10000;

      for (let i = 0; i < streamingChecks; i++) {
        await page.waitForTimeout(checkInterval);

        const isVisible = await streamingMsg.isVisible().catch(() => false);
        if (!isVisible) break;

        const content = await streamingMsg.locator('.markdown-content').textContent();
        const currentLength = content?.length || 0;

        // Only check if content is growing if we have previous content
        if (previousLength > 0 && currentLength === previousLength) {
          // Content stopped growing, streaming might be done
          break;
        }

        if (currentLength > previousLength) {
          previousLength = currentLength;
        }

        const input = page.locator('[data-testid="message-input"]');
        const isInputDisabled = await input.isDisabled();
        expect(isInputDisabled).toBe(true);

        await expect(streamingMsg).toBeInViewport();
      }
    }

    await waitForStreamingComplete(page, 120000);

    const response = await page
      .locator('.message.assistant')
      .last()
      .locator('.markdown-content')
      .textContent();
    expect(response?.length).toBeGreaterThan(2000);

    const codeBlocks = await page.locator('.code-block-wrapper').count();
    expect(codeBlocks).toBeGreaterThanOrEqual(3);

    await page.locator('.message.assistant h2, .message.assistant h3').count();
    await page.locator('.message.assistant ul, .message.assistant ol').count();

    const copyButtons = await page.locator('.copy-btn').count();
    expect(copyButtons).toBe(codeBlocks);

    const messagesContainer = page.locator('.messages');
    await messagesContainer.evaluate((el) => (el.scrollTop = 0));
    await page.waitForTimeout(500);
    await messagesContainer.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.waitForTimeout(500);
  });
});
