import { test, expect, ElectronApplication, Page } from '@playwright/test';
import {
  navigateToThreads,
  selectAgentAndModel,
  authenticateWithTestKey,
  waitForStreamingComplete,
  ensureAgentsLoaded,
} from '../helpers/ui-helpers';
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

    // Authenticate if needed
    await authenticateWithTestKey(page);

    // Navigate to Threads page
    await navigateToThreads(page);

    // Ensure agents are loaded (with retry logic)
    const agentsAvailable = await ensureAgentsLoaded(page);
    expect(agentsAvailable).toBe(true);

    const agentSelect = page.locator('select#agent-select');
    let selectedAgentId: string | null = null;
    let selectedModelId: string | null = null;

    // Get first agent ID
    const agentOptions = agentSelect.locator('option');
    const firstAgentValue = await agentOptions.nth(0).getAttribute('value');
    if (firstAgentValue) {
      selectedAgentId = firstAgentValue;
      await agentSelect.selectOption(firstAgentValue);
      await page.waitForTimeout(500); // Wait for models to load
    }

    // Check if model selector exists (appears when agent has multiple models)
    const modelSelect = page.locator('select.model-selector-compact');
    const modelCount = await modelSelect.count();

    if (modelCount > 0) {
      // Multiple models available - select Opus 4
      await expect(modelSelect).toBeVisible();

      // Try to select Claude Opus 4 model (claude-opus-4-20250514)
      const opus4Option = modelSelect.locator('option').filter({ hasText: /opus-4|20250514/i });
      if ((await opus4Option.count()) > 0) {
        const opus4Value = await opus4Option.first().getAttribute('value');
        if (opus4Value) {
          selectedModelId = opus4Value;
          await modelSelect.selectOption(opus4Value);
          await page.waitForTimeout(500);
        }
      } else {
        // Fallback: try to select any opus model
        const opusOption = modelSelect.locator('option').filter({ hasText: /opus/i });
        if ((await opusOption.count()) > 0) {
          const opusValue = await opusOption.first().getAttribute('value');
          if (opusValue) {
            selectedModelId = opusValue;
            await modelSelect.selectOption(opusValue);
            await page.waitForTimeout(500);
          }
        } else {
          // Last fallback: select first available model
          const modelOptions = modelSelect.locator('option');
          const firstModelValue = await modelOptions.nth(0).getAttribute('value');
          if (firstModelValue) {
            selectedModelId = firstModelValue;
            await modelSelect.selectOption(firstModelValue);
            await page.waitForTimeout(500);
          }
        }
      }
    }

    // Fill prompt and create thread
    const promptText = 'E2E Model Selection Test - Just respond with OK';
    const promptTextarea = page.locator('textarea#thread-prompt');
    await expect(promptTextarea).toBeVisible({ timeout: 3000 });
    await promptTextarea.fill(promptText);

    // Send to create thread
    const sendButton = page.getByRole('button', { name: /Send/ });
    await expect(sendButton).toBeEnabled({ timeout: 2000 });
    await sendButton.click();

    // Wait for thread creation and navigation
    await page.waitForTimeout(3000);

    // Handle two cases:
    // Case 1: Submit navigates directly to chat view (expected behavior)
    // Case 2: Submit doesn't navigate, need to manually click first thread in list
    const chatPane = page.locator('.chat-pane');
    const isChatVisible = await chatPane.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isChatVisible) {
      // Case 2: Didn't navigate automatically, click first thread in list
      await page.waitForTimeout(1000);
      const firstThread = page.locator('div.thread-item').first();
      await expect(firstThread).toBeVisible({ timeout: 5000 });
      await firstThread.click();
      await expect(chatPane).toBeVisible({ timeout: 5000 });
    }

    // Wait for chat view to appear (thread created)
    await expect(chatPane).toBeVisible({ timeout: 15000 });

    // Wait for user message to appear
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: promptText }),
    ).toBeVisible({ timeout: 5000 });

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
    if (selectedModelId) {
      expect(threadMetadata.modelId).toBeDefined();
      console.log('Thread metadata:', threadMetadata);
    }
  });
});
