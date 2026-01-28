import { test, expect, type ElectronApplication } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import {
  createThread,
  waitForStreamingComplete,
  ensureAgentsLoaded,
  navigateToThreads,
} from '../helpers/ui-helpers';

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

    // Use Haiku 3.5 for more verbose responses in E2E tests
    await createThread(page, prompt, undefined, 'claude-3-5-haiku-20241022');

    // Wait for user message to appear with increased timeout
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }).last(),
    ).toBeVisible({ timeout: 30000 });

    // Wait for assistant message to appear and streaming to complete
    const assistantMessage = page.locator('.messages .message.assistant').last();
    await expect(assistantMessage).toBeVisible({ timeout: 60000 });

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

    await page.reload();
    await page.waitForLoadState('networkidle');

    await navigateToThreads(page);

    const threadItem = page.getByRole('menuitem', { name: /france|capital/i }).first();
    await expect(threadItem).toBeVisible({ timeout: 5000 });
    await threadItem.click();

    await page.waitForTimeout(1000);
    await expect(page.locator('.chat-pane')).toBeVisible({ timeout: 5000 });

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }).last(),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator('.messages .message.assistant .message-content', { hasText: /paris/i }).last(),
    ).toBeVisible({ timeout: 15000 });

    const persistedMeta = page.locator(
      '.messages .message.assistant .message-footer .message-meta',
    );
    await expect(persistedMeta.last()).toContainText('/', { timeout: 5000 });
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
    await expect(assistant).toBeVisible({ timeout: 60000 });

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
    expect(elapsedMs).toBeLessThan(120000);
  });

  test('Prompt 3: Very concise question', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const prompt = 'Explain recursion in one sentence';
    const start = Date.now();

    await createThread(page, prompt);

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }).last(),
    ).toBeVisible({ timeout: 10000 });

    // Wait for assistant message to appear
    const assistant = page.locator('.messages .message.assistant').last();
    await expect(assistant).toBeVisible({ timeout: 60000 });

    // Wait for streaming to complete
    await waitForStreamingComplete(page);

    // Additional wait to ensure content is fully rendered
    await page.waitForTimeout(3000);

    const assistantContent = page.locator('.messages .message.assistant .message-content').last();
    await expect(assistantContent).toBeVisible({ timeout: 10000 });

    const response = (await assistantContent.textContent()) ?? '';
    console.log('Recursion response:', response);

    expect(response.length).toBeLessThan(500);
    expect(response.toLowerCase()).toContain('recurs');

    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(120000);
  });

  test('All models handle small prompts', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const prompt = 'What is 2+2?';
    const start = Date.now();

    // Use createThread which automatically selects Claude Opus 4
    await createThread(page, prompt);

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }).last(),
    ).toBeVisible({ timeout: 10000 });

    // Wait for assistant message to appear
    const assistantMessage = page.locator('.messages .message.assistant').last();
    await expect(assistantMessage).toBeVisible({ timeout: 60000 });

    // Wait for streaming to complete
    await waitForStreamingComplete(page);

    // Additional wait to ensure content is fully rendered
    await page.waitForTimeout(3000);

    const assistantContent = page.locator('.messages .message.assistant .message-content').last();
    await expect(assistantContent).toBeVisible({ timeout: 10000 });

    const responseText = (await assistantContent.textContent()) ?? '';
    console.log('Math response:', responseText);

    expect(responseText.trim().length).toBeGreaterThan(0);
    expect(responseText.toLowerCase()).toMatch(/4|four/i);

    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(120000); // 2 minutes for AI response
  });

  test('UI remains responsive during streaming', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    const prompt = 'Write a Python function to calculate fibonacci numbers';

    await createThread(page, prompt);

    const streamingMessage = page.locator('.message.assistant.streaming');
    await streamingMessage.waitFor({ state: 'visible', timeout: 60000 });

    const input = page.locator('[data-testid="message-input"]');
    await expect(input).toBeDisabled({ timeout: 2000 });

    const sendButton = page.getByRole('button', { name: 'Sending message...' });
    await expect(sendButton).toBeVisible({ timeout: 2000 });

    await page.mouse.wheel(0, 200);

    const sidebar = page.locator('[data-testid="sidebar"]');
    if (await sidebar.count()) {
      await expect(sidebar.first()).toBeVisible();
    }

    await waitForStreamingComplete(page);
  });

  test('Thread auto-title updates with small prompt', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await navigateToThreads(page);
    await page.waitForTimeout(1000);

    const header = page.locator('.chat-header h2');
    const initialTitle = await header.textContent().catch(() => '');

    const prompt = 'What is the capital of France?';

    const agentSelect = page.locator('select#agent-select');
    const chatPane = page.locator('.chat-pane');

    const isCreateFormVisible = await agentSelect.isVisible().catch(() => false);
    const isChatPaneVisible = await chatPane.isVisible().catch(() => false);

    if (!isCreateFormVisible && !isChatPaneVisible) {
      const newThreadButton = page
        .getByRole('complementary', { name: 'Activity list sidebar' })
        .getByRole('button', { name: 'Create new thread' })
        .first();
      if (await newThreadButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newThreadButton.click();
        await page.waitForTimeout(500);
      }
    }

    if (isChatPaneVisible && !isCreateFormVisible) {
      const newThreadButton = page
        .getByRole('complementary', { name: 'Activity list sidebar' })
        .getByRole('button', { name: 'Create new thread' })
        .first();
      if (await newThreadButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newThreadButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Ensure agents are loaded with retry logic
    const agentsAvailable = await ensureAgentsLoaded(page);
    expect(agentsAvailable).toBe(true);

    // Select first agent
    const agentOptions = agentSelect.locator('option');
    const agentCount = await agentOptions.count();
    if (agentCount > 0) {
      await agentSelect.selectOption({ index: 0 });
      await page.waitForTimeout(500);
    }

    // Select model if model selector exists
    const modelSelect = page.locator('select.model-selector-compact');
    if ((await modelSelect.count()) > 0) {
      await expect(modelSelect).toBeVisible({ timeout: 5000 });
      const modelOptions = modelSelect.locator('option');
      const modelCount = await modelOptions.count();
      if (modelCount > 1) {
        await modelSelect.selectOption({ index: 1 });
      }
    }

    const promptTextarea = page.locator('textarea#thread-prompt');
    await expect(promptTextarea).toBeVisible({ timeout: 3000 });
    await promptTextarea.fill(prompt);
    await promptTextarea.press('Enter');

    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }).last(),
    ).toBeVisible({ timeout: 60000 });

    await waitForStreamingComplete(page);

    await page.waitForTimeout(60000);

    const titleText = (await header.textContent()) ?? '';

    expect(titleText.trim().length).toBeGreaterThan(0);
    if (initialTitle) {
      expect(titleText).not.toBe(initialTitle);
    }
    expect(titleText.toLowerCase()).toMatch(/france|capital/);
  });
});
