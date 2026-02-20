/**
 * Shared UI Helper Functions for E2E Tests
 *
 * These helpers abstract UI interactions to make tests more maintainable
 * and resilient to UI changes.
 */

import { expect } from '@playwright/test';
import type { Page } from 'playwright';

/**
 * Standard test prompt for simple response tests
 * Use this instead of creating unique prompts that do the same thing.
 * Reduces API costs and test execution time.
 */
export const SIMPLE_TEST_PROMPT = 'Just respond with OK';

/**
 * Model lookup helper - finds model by name pattern
 * Avoids hardcoding specific model IDs with dates
 *
 * @param page - Playwright page object
 * @param modelName - Model type to find: 'opus', 'sonnet', or 'haiku'
 * @returns Model ID (value attribute) or null if not found
 *
 * @example
 * const opusId = await findModelByName(page, 'opus');
 * await createThread(page, 'Hello', undefined, opusId);
 */
export async function findModelByName(
  page: Page,
  modelName: 'opus' | 'sonnet' | 'haiku',
): Promise<string | null> {
  const modelSelect = page.locator('select.model-selector-compact');

  // Wait for model selector to be visible and populated
  await expect(modelSelect).toBeVisible({ timeout: 10000 });
  await expect(modelSelect.locator('option')).not.toHaveCount(0, { timeout: 10000 });

  // Get all options
  const options = modelSelect.locator('option');
  const count = await options.count();

  // Search patterns for each model type (matches latest versions)
  const patterns: Record<string, RegExp> = {
    opus: /opus.*4/i, // Match "opus 4" or "opus-4"
    sonnet: /sonnet.*3\.?5/i, // Match "sonnet 3.5" or "sonnet-3.5"
    haiku: /haiku/i, // Match any "haiku" (will prefer 3.5 if available)
  };

  const pattern = patterns[modelName];

  // Search through options
  for (let i = 0; i < count; i++) {
    const option = options.nth(i);
    const text = await option.textContent();
    const value = await option.getAttribute('value');

    if (text && value && pattern.test(text)) {
      console.log(`✓ Found ${modelName} model: ${value} (${text})`);
      return value;
    }
  }

  console.warn(`⚠ No ${modelName} model found, returning null`);
  return null;
}

/**
 * Check if models are already loaded by checking if model selector has options
 */
async function areModelsLoaded(page: Page): Promise<boolean> {
  try {
    // Check if we're on a page with a model selector
    const modelSelect = page.locator('select.model-selector-compact, select#agent-select');
    const selectCount = await modelSelect.count();

    if (selectCount === 0) {
      return false; // No model selector visible
    }

    // Check if the selector has options (models loaded)
    const options = modelSelect.first().locator('option');
    const optionCount = await options.count();

    return optionCount > 0;
  } catch {
    return false;
  }
}

/**
 * Navigate to Home page
 * Just navigates to home and waits briefly for the page to load
 */
export async function navigateToHome(page: Page): Promise<void> {
  const homeMenuItem = page.getByRole('menuitem', { name: 'Home' });
  await expect(homeMenuItem).toBeVisible({ timeout: 10000 });
  await homeMenuItem.click();

  // Wait for home page to load
  await page.waitForLoadState('networkidle');

  // Wait briefly for UI to stabilize (5 seconds as suggested)
  await page.waitForTimeout(5000);
  console.log('[navigateToHome] Home page loaded');
}

/**
 * Navigate to Threads page and wait for it to load
 * Note: Should call navigateToHome() first to ensure models are loaded
 */
export async function navigateToThreads(page: Page): Promise<void> {
  // Check if we're in a chat view - if so, we need to navigate to threads list first
  const currentUrl = page.url();
  const isInChatView = currentUrl.includes('threadId=');

  if (isInChatView) {
    // Wait for streaming to complete before navigating
    console.log('[E2E] Checking if streaming is in progress...');
    const streamingIndicator = page.locator('text=/Streaming/i');
    const isStreaming = await streamingIndicator.isVisible({ timeout: 1000 }).catch(() => false);

    if (isStreaming) {
      console.log('[E2E] Waiting for streaming to complete...');
      // Wait for streaming to finish (indicator disappears)
      // Use shorter timeout (30s) and force navigate if stuck
      try {
        await streamingIndicator.waitFor({ state: 'hidden', timeout: 30000 });
        await page.waitForTimeout(1000); // Extra wait for UI to stabilize
        console.log('[E2E] Streaming completed');
      } catch (error) {
        console.warn('[E2E] Streaming did not complete within 30s, forcing navigation...');
        // Streaming is stuck (backend issue) - force navigate anyway
        // The navigation will interrupt the stuck streaming
      }
    }

    // Check for and dismiss "Unsaved Changes" modal if present (fallback)
    const unsavedModal = page.locator('text=Unsaved Changes');
    if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('[E2E] Dismissing unsaved changes modal...');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    }

    // We're in a chat view, click Threads to go to threads list
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(1000);

    // Wait for URL to change away from chat view, or check if we're already there
    try {
      await expect(page).not.toHaveURL(/threadId=/, { timeout: 10000 });
    } catch (error) {
      // If timeout, check if we're already on threads page (no threadId in URL)
      const currentUrl = page.url();
      if (!currentUrl.includes('threadId=')) {
        console.log('[navigateToThreads] Already on threads page after navigation');
      } else {
        // Still on thread view - try clicking Threads again
        console.log('[navigateToThreads] Navigation failed, retrying...');
        await page.getByRole('menuitem', { name: 'Threads' }).click();
        await page.waitForTimeout(2000);
      }
    }
  } else {
    // Not in chat view, but still check for modal before clicking
    const unsavedModal = page.locator('text=Unsaved Changes');
    if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('[E2E] Dismissing unsaved changes modal before navigation...');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    }

    // Click Threads menu item
    await page.getByRole('menuitem', { name: 'Threads' }).click();
  }

  // Wait for URL to contain /threads
  await expect(page).toHaveURL(/\/threads/, { timeout: 10000 });

  await page.waitForLoadState('networkidle');

  // Wait for either agent selector (thread creation form) or thread list to be visible
  const agentSelect = page.locator('select#agent-select');
  const threadList = page.locator('[role="menuitem"]').first();

  try {
    await expect(agentSelect).toBeVisible({ timeout: 50000 });
    // If agent selector is visible, ensure agents are loaded with retry logic
    await ensureAgentsLoaded(page);
  } catch {
    // If agent selector not visible, we might be on thread list - that's okay
    await expect(threadList).toBeVisible({ timeout: 5000 });
  }
}

export async function navigateToProjects(page: Page): Promise<void> {
  const homeMenuItem = page.getByRole('menuitem', { name: 'Projects' });
  await expect(homeMenuItem).toBeVisible({ timeout: 10000 });
  await homeMenuItem.click();

  // Wait for projects page to load
  await page.waitForLoadState('networkidle');

  // Wait for projects list or empty state to be visible
  const projectsList = page.locator('.projects-list, .empty-state');
  await expect(projectsList).toBeVisible({ timeout: 10000 });
}

/**
 * Select an agent and optionally a specific model
 *
 * @param page - Playwright page object
 * @param agentId - Optional agent ID to select (uses default if not provided)
 * @param modelId - Optional model ID to select (uses default if not provided)
 */
export async function selectAgentAndModel(
  page: Page,
  agentId?: string,
  modelId?: string,
): Promise<void> {
  // Wait for agent selector to be visible
  const agentSelect = page.locator('select#agent-select');
  try {
    await expect(agentSelect).toBeVisible({ timeout: 60000 });
  } catch (error) {
    console.log('[selectAgentAndModel] Agent selector not visible, attempting recovery...');
    // Try to navigate to Home and back to Threads to trigger model/agent loading
    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.waitForTimeout(2000);
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(2000);
    await expect(agentSelect).toBeVisible({ timeout: 30000 });
  }

  // CRITICAL: Wait for options to be populated before trying to interact
  console.log('[selectAgentAndModel] Waiting for agent options to load...');
  await expect(agentSelect.locator('option')).not.toHaveCount(0, { timeout: 60000 });

  // Verify options are loaded
  const agentOptions = agentSelect.locator('option');
  const optionCount = await agentOptions.count();
  console.log(`[selectAgentAndModel] Found ${optionCount} agent options`);

  if (optionCount === 0) {
    throw new Error('No agent options available after waiting');
  }

  // Select agent if specified, otherwise select first agent
  if (agentId) {
    await agentSelect.selectOption(agentId);
    console.log(`✓ Selected agent: ${agentId}`);
  } else {
    // Select first agent to ensure models load
    const firstOption = await agentSelect.locator('option').first();
    const firstValue = await firstOption.getAttribute('value');
    if (firstValue) {
      await agentSelect.selectOption(firstValue);
      console.log(`✓ Selected first agent: ${firstValue}`);
    }
  }

  // Wait for models to load after agent selection
  await page.waitForTimeout(1000);

  // Select model if specified and model selector exists
  const modelSelect = page.locator('select.model-selector-compact');
  const modelCount = await modelSelect.count();

  if (modelCount > 0) {
    await expect(modelSelect).toBeVisible({ timeout: 50000 });

    // Wait for model options to be populated
    console.log('[selectAgentAndModel] Waiting for model options to load...');
    await expect(modelSelect.locator('option')).not.toHaveCount(0, { timeout: 30000 });

    // Use model lookup if no specific model ID provided
    let targetModelId = modelId;

    if (!targetModelId) {
      // Default to Haiku 3.5 for E2E tests (faster and cost-effective)
      console.log('[selectAgentAndModel] Looking up Haiku model...');
      targetModelId = (await findModelByName(page, 'haiku')) || undefined;

      if (!targetModelId) {
        console.warn('[selectAgentAndModel] Haiku not found, trying Opus 4...');
        targetModelId = (await findModelByName(page, 'opus')) || undefined;
      }

      if (!targetModelId) {
        console.warn(
          '[selectAgentAndModel] No preferred model found, will use first available model',
        );
      }
    }

    if (targetModelId) {
      try {
        await modelSelect.selectOption(targetModelId);
        console.log(`✓ Selected model: ${targetModelId}`);
      } catch (error) {
        console.warn(`⚠ Failed to select model ${targetModelId}, selecting first available...`);
        const firstModelOption = await modelSelect.locator('option').first();
        const firstModelValue = await firstModelOption.getAttribute('value');
        if (firstModelValue) {
          await modelSelect.selectOption(firstModelValue);
          console.log(`✓ Selected first available model: ${firstModelValue}`);
        }
      }
    } else {
      // No model specified and lookup failed - select first available
      const firstModelOption = await modelSelect.locator('option').first();
      const firstModelValue = await firstModelOption.getAttribute('value');
      if (firstModelValue) {
        await modelSelect.selectOption(firstModelValue);
        console.log(`✓ Selected first available model: ${firstModelValue}`);
      }
    }
  }
}

/**
 * Wait for the message input to be ready for interaction
 */
export async function waitForMessageInput(page: Page): Promise<void> {
  const input = page.locator('[data-testid="message-input"]');

  // Wait for input to exist and be visible
  await expect(input).toBeVisible({ timeout: 60000 });

  // First, wait for any streaming to complete (if there is streaming)
  try {
    // Check if there's a streaming message
    const streamingMessage = page.locator('.message.assistant.streaming');
    const isStreaming = await streamingMessage.isVisible({ timeout: 2000 }).catch(() => false);

    if (isStreaming) {
      // Wait for streaming to complete
      await expect(streamingMessage).toBeHidden({ timeout: 120000 });
    }
  } catch (error) {
    // No streaming message found, continue
  }

  // Wait for input to be enabled (not disabled by streaming)
  // Use polling with locator instead of waitForFunction to avoid CSP violations
  await expect(input).not.toBeDisabled({ timeout: 120000 });
}

/**
 * Create a new thread with the simplified flow
 *
 * @param page - Playwright page object
 * @param prompt - The initial prompt text
 * @param agentId - Optional agent ID (uses default if not provided)
 * @param modelId - Optional model ID (uses default if not provided)
 */
export async function createThread(
  page: Page,
  prompt: string,
  agentId?: string,
  modelId?: string,
): Promise<void> {
  // First navigate to home to load models (only on first call)
  // For subsequent calls in serial tests, we're already authenticated with models loaded
  const currentUrl = page.url();
  const isFirstCall =
    !currentUrl.includes('/home') &&
    !currentUrl.includes('/threads') &&
    !currentUrl.includes('threadId=');

  if (isFirstCall) {
    await navigateToHome(page);
  }

  // If we're in a chat view, explicitly navigate to threads first
  if (currentUrl.includes('threadId=')) {
    // Check for and dismiss "Unsaved Changes" modal before navigation
    const unsavedModal = page.locator('text=Unsaved Changes');
    if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('[createThread] Dismissing unsaved changes modal...');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    }

    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(1000);
  }

  // Navigate to threads page
  await navigateToThreads(page);

  // Dismiss any "Unsaved Changes" dialog that might appear from previous test
  const dismissUnsavedChangesModal = async () => {
    const unsavedModal = page.locator('text=Unsaved Changes');
    if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('[createThread] Dismissing unsaved changes modal...');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    }
  };
  await dismissUnsavedChangesModal();

  // Check if agent selector is already visible (we're on the creation form)
  const agentSelect = page.locator('select#agent-select');
  const isAgentSelectVisible = await agentSelect.isVisible({ timeout: 2000 }).catch(() => false);

  if (!isAgentSelectVisible) {
    // Agent selector not visible - we need to click "New Thread" button
    console.log('[createThread] Agent selector not visible, clicking New Thread button...');

    const newThreadButton = page
      .getByRole('button', { name: /create new thread|new thread/i })
      .first();
    await expect(newThreadButton).toBeVisible({ timeout: 5000 });

    // Click and wait for navigation/form to appear
    await newThreadButton.click();
    await page.waitForTimeout(2000); // Wait for form to appear
    await dismissUnsavedChangesModal();

    // Check if agent selector appeared
    let isFormVisible = await agentSelect.isVisible({ timeout: 3000 }).catch(() => false);

    // If form didn't appear, check if we're in a thread view with an error
    if (!isFormVisible) {
      const currentUrl = page.url();
      const isInThreadView = currentUrl.includes('threadId=');

      if (isInThreadView) {
        console.log(
          '[createThread] In thread view with error, navigating to another thread and back...',
        );

        // Get thread list
        const threadList = page
          .locator('div.thread-item, [role="menuitem"]')
          .filter({ hasText: /\d+\/\d+/ });
        const threadCount = await threadList.count();

        if (threadCount > 1) {
          // Click second thread
          await threadList.nth(1).click();
          await page.waitForTimeout(1000);

          // Navigate back to threads list
          await page.getByRole('menuitem', { name: 'Threads' }).click();
          await page.waitForTimeout(1000);
        } else {
          // No other threads, navigate to Home and back
          await page.getByRole('menuitem', { name: 'Home' }).click();
          await page.waitForTimeout(1000);
          await page.getByRole('menuitem', { name: 'Threads' }).click();
          await page.waitForTimeout(1000);
        }

        // Try clicking New Thread button again
        await newThreadButton.click();
        await page.waitForTimeout(2000);
        isFormVisible = await agentSelect.isVisible({ timeout: 3000 }).catch(() => false);
      }
    }

    // If form still didn't appear, try force click
    if (!isFormVisible) {
      console.log('[createThread] Form did not appear, retrying with force click...');
      await newThreadButton.click({ force: true });
      await page.waitForTimeout(2000);
      await dismissUnsavedChangesModal();
      isFormVisible = await agentSelect.isVisible({ timeout: 3000 }).catch(() => false);
    }

    // If still not visible, navigate to Home and back as last resort
    if (!isFormVisible) {
      console.log('[createThread] Form still not visible, navigating to Home and back...');
      await page.getByRole('menuitem', { name: 'Home' }).click();
      await page.waitForTimeout(1000);
      await page.getByRole('menuitem', { name: 'Threads' }).click();
      await page.waitForTimeout(2000);

      // Try clicking button again after navigation
      await newThreadButton.click();
      await page.waitForTimeout(2000);
      isFormVisible = await agentSelect.isVisible({ timeout: 3000 }).catch(() => false);
    }

    // Final wait for agent selector to appear with retry logic
    // If it doesn't appear, try navigating to another thread and back
    let agentSelectorVisible = await agentSelect.isVisible({ timeout: 10000 }).catch(() => false);

    if (!agentSelectorVisible) {
      console.log(
        '[createThread] Agent selector still not visible, trying thread navigation recovery...',
      );

      // Always try recovery by navigating to another thread and back
      console.log('[createThread] Attempting recovery by navigating to another thread and back...');

      try {
        const currentUrl = page.url();
        const isInThreadView = currentUrl.includes('threadId=');
        const chatPane = page.locator('.chat-pane');

        // Navigate to threads list first (if not already there)
        if (isInThreadView) {
          await page.getByRole('menuitem', { name: 'Threads' }).click();
          await page.waitForTimeout(1000);

          // Wait for threads list to be visible
          await expect(page).not.toHaveURL(/threadId=/, { timeout: 10000 });
        }

        // Get thread list
        const threadList = page
          .locator('div.thread-item, [role="menuitem"]')
          .filter({ hasText: /\d+\/\d+/ });
        const threadCount = await threadList.count();

        if (threadCount > 1) {
          // Click second thread
          console.log('[createThread] Clicking second thread to refresh state...');
          await threadList.nth(1).click();
          await page.waitForTimeout(2000);

          // Wait for chat pane to appear
          await expect(chatPane)
            .toBeVisible({ timeout: 10000 })
            .catch(() => {});

          // Navigate back to threads list
          await page.getByRole('menuitem', { name: 'Threads' }).click();
          await page.waitForTimeout(1000);

          // Wait for threads list to be visible - use locator check instead of URL
          const newThreadButtonCheck = page.getByRole('button', {
            name: /create new thread|new thread/i,
          });
          await expect(newThreadButtonCheck)
            .toBeVisible({ timeout: 10000 })
            .catch(() => {});
        } else {
          // No other threads, navigate to Home and back
          console.log('[createThread] No other threads, navigating to Home and back...');
          await page.getByRole('menuitem', { name: 'Home' }).click();
          await page.waitForTimeout(1000);
          await page.getByRole('menuitem', { name: 'Threads' }).click();
          await page.waitForTimeout(2000);
        }

        // Try clicking New Thread button again after navigation
        const newThreadButtonAfterNav = page
          .getByRole('button', { name: /create new thread|new thread/i })
          .first();
        await expect(newThreadButtonAfterNav).toBeVisible({ timeout: 5000 });
        await newThreadButtonAfterNav.click();
        await page.waitForTimeout(2000);
        await dismissUnsavedChangesModal();

        // Final retry wait for agent selector
        agentSelectorVisible = await agentSelect.isVisible({ timeout: 15000 }).catch(() => false);

        if (agentSelectorVisible) {
          console.log('[createThread] Agent selector now visible after recovery');
        } else {
          console.log(
            '[createThread] Agent selector still not visible after recovery, throwing error...',
          );
          throw new Error('Agent selector did not appear after recovery attempts');
        }
      } catch (recoveryError) {
        console.error('[createThread] Recovery attempt failed:', recoveryError);
        // Still try one more time to see the agent selector
        agentSelectorVisible = await agentSelect.isVisible({ timeout: 5000 }).catch(() => false);
        if (!agentSelectorVisible) {
          throw new Error(
            `Agent selector did not appear. Recovery attempt failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
          );
        }
      }
    } else {
      console.log('[createThread] Agent selector now visible');
    }
  } else {
    // Agent selector is visible - we're already on the form
    // Clear any existing prompt text to avoid "Unsaved Changes" modal
    const promptTextarea = page.locator('textarea#thread-prompt');
    const currentText = await promptTextarea.inputValue().catch(() => '');
    if (currentText) {
      console.log('[createThread] Clearing existing prompt text...');
      await promptTextarea.clear();
      await page.waitForTimeout(300);
    }
  }

  // Select agent/model - always select agent and Claude Opus 4 by default
  await selectAgentAndModel(page, agentId, modelId);

  // Fill prompt
  const promptTextarea = page.locator('textarea#thread-prompt');
  await expect(promptTextarea).toBeVisible({ timeout: 5000 });

  // Clear any existing text first
  await promptTextarea.clear();
  await page.waitForTimeout(200);

  // Fill the prompt
  await promptTextarea.fill(prompt);
  await page.waitForTimeout(300);

  // Verify the prompt was actually filled
  const filledText = await promptTextarea.inputValue();
  if (!filledText || filledText.trim().length === 0) {
    throw new Error(
      `Failed to fill prompt. Expected: "${prompt.substring(0, 50)}...", Got: "${filledText}"`,
    );
  }

  // Ensure prompt matches (at least partially)
  if (!filledText.includes(prompt.substring(0, Math.min(20, prompt.length)))) {
    console.warn(
      `[createThread] Prompt text mismatch. Expected to contain: "${prompt.substring(0, 20)}", Got: "${filledText.substring(0, 50)}"`,
    );
    // Try filling again
    await promptTextarea.fill(prompt);
    await page.waitForTimeout(300);
  }

  // Submit by clicking Send button (more reliable than Enter for multi-line prompts)
  const sendButton = page.getByRole('button', { name: /send/i });
  await expect(sendButton).toBeVisible({ timeout: 3000 });

  // Verify send button is enabled before clicking
  const isEnabled = await sendButton.isEnabled();
  if (!isEnabled) {
    // Wait a bit more for validation to enable the button
    await page.waitForTimeout(500);
    const stillDisabled = await sendButton.isEnabled();
    if (!stillDisabled) {
      throw new Error('Send button is disabled. Prompt may be empty or invalid.');
    }
  }

  await sendButton.click();
  await page.waitForTimeout(1000);
  await dismissUnsavedChangesModal();

  // Wait for thread to be created and appear in sidebar
  await page.waitForTimeout(2000);

  const chatPane = page.locator('.chat-pane');
  const isChatVisible = await chatPane.isVisible({ timeout: 3000 }).catch(() => false);

  if (!isChatVisible) {
    // Thread created but didn't navigate - click the thread in sidebar
    await page.waitForTimeout(1000);

    // The thread we just created should be the first one (most recent)
    // Try multiple selectors to find the thread item
    let threadItem = page.locator('div.thread-item').first();

    // If div.thread-item doesn't exist, try menuitem with the prompt text
    if ((await threadItem.count()) === 0) {
      threadItem = page.locator('[role="menuitem"]').first();
    }

    await expect(threadItem).toBeVisible({ timeout: 5000 });

    // Dismiss any "Unsaved Changes" modal that might be blocking
    const unsavedModal = page.locator('text=Unsaved Changes');
    if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('[createThread] Dismissing unsaved changes modal before clicking thread...');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    }

    await threadItem.click();
    await page.waitForTimeout(2000); // Increased wait time for navigation

    // Wait for chat pane to be visible (more reliable than URL checking)
    // Check if chat pane becomes visible first
    const chatPaneVisible = await chatPane.isVisible({ timeout: 10000 }).catch(() => false);

    if (!chatPaneVisible) {
      // Chat pane not visible, try waiting for URL change
      try {
        await expect(page).toHaveURL(/threadId=/, { timeout: 10000 });
        // After URL changes, wait for chat pane
        await expect(chatPane).toBeVisible({ timeout: 10000 });
      } catch (error) {
        // If URL didn't change either, dismiss modal and try clicking thread again
        console.log(
          '[createThread] Navigation failed, dismissing modal and retrying thread click...',
        );
        const modalStillVisible = await unsavedModal
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        if (modalStillVisible) {
          await page.getByRole('button', { name: 'Cancel' }).click();
          await page.waitForTimeout(500);
        }
        await threadItem.click();
        await page.waitForTimeout(2000);
        await expect(chatPane).toBeVisible({ timeout: 10000 });
      }
    }
  }

  // Wait for chat view to be fully loaded
  try {
    await expect(chatPane).toBeVisible({ timeout: 30000 });
  } catch (error) {
    console.log('[createThread] Chat pane not visible after navigation, retrying click...');
    // Try clicking the thread item again as a last resort
    const threadItemRetry = page.locator('div.thread-item, [role="menuitem"]').first();
    if (await threadItemRetry.isVisible()) {
      await threadItemRetry.click();
      await expect(chatPane).toBeVisible({ timeout: 30000 });
    } else {
      throw error;
    }
  }

  // CRITICAL: Verify user message appeared after thread creation
  // If not, force UI refresh to recover from error state
  console.log('[createThread] Verifying user message appeared...');

  // Normalize prompt for matching (handles whitespace/newline differences)
  const normalizedPrompt = prompt.trim().replace(/\s+/g, ' ');
  const partialPrompt = prompt.substring(0, 50).trim().replace(/\s+/g, ' ');

  // Try multiple ways to find the user message
  const findUserMessage = async () => {
    // 1. Try partial match with first 50 chars (most reliable for large prompts)
    let userMsg = page.locator('.messages .message.user .message-content', {
      hasText: partialPrompt,
    });
    if (await userMsg.isVisible({ timeout: 2000 }).catch(() => false)) return true;

    // 2. Try any user message at all (fallback if matching fails)
    let anyMsg = page.locator('.messages .message.user').first();
    if (await anyMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[createThread] Found user message but not matching prompt text, accepting it.');
      return true;
    }

    // 3. Try match with normalized prompt (handles collapsed whitespace)
    let exactMsg = page.locator('.messages .message.user .message-content', {
      hasText: normalizedPrompt.substring(0, 100),
    });
    if (await exactMsg.isVisible({ timeout: 1000 }).catch(() => false)) return true;

    return false;
  };

  let isUserMessageVisible = await findUserMessage();

  if (!isUserMessageVisible) {
    console.log('[createThread] User message not visible, forcing UI refresh...');
    await forceThreadRefresh(page);

    // Wait for messages container to be visible and loaded
    const messagesContainer = page.locator('.messages');
    await expect(messagesContainer).toBeVisible({ timeout: 15000 });

    // Wait a bit for messages to load
    await page.waitForTimeout(3000);

    // Check if messages are loading
    let messageCount = await messagesContainer.locator('.message').count();
    let retries = 0;
    const maxRetries = 10; // Increased retries

    while (messageCount === 0 && retries < maxRetries) {
      await page.waitForTimeout(1000);
      messageCount = await messagesContainer.locator('.message').count();
      retries++;
      if (messageCount === 0 && retries < maxRetries) {
        console.log(`[createThread] No messages found, retry ${retries}/${maxRetries}...`);
      }
    }

    // Check again after refresh and waiting
    isUserMessageVisible = await findUserMessage();

    if (!isUserMessageVisible) {
      // Last resort: try navigating to threads and back one more time
      console.log('[createThread] User message still not visible, trying one more navigation...');
      await page.getByRole('menuitem', { name: 'Threads' }).click();
      await page.waitForTimeout(2000);

      // Find and click the thread we just created
      const threadList = page
        .locator('div.thread-item, [role="menuitem"]')
        .filter({ hasText: /\d+\/\d+/ });
      const threadCount = await threadList.count();

      if (threadCount > 0) {
        await threadList.first().click();
        await page.waitForTimeout(3000);

        // Wait for chat pane and messages
        await expect(chatPane).toBeVisible({ timeout: 15000 });
        await expect(messagesContainer).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(2000);

        // Final check
        isUserMessageVisible = await findUserMessage();
      }

      if (!isUserMessageVisible) {
        throw new Error(
          `User message did not appear after thread creation. Prompt: "${prompt.substring(0, 50)}..."`,
        );
      } else {
        console.log('[createThread] User message now visible after final navigation');
      }
    } else {
      console.log('[createThread] User message now visible after refresh');
    }
  } else {
    console.log('[createThread] User message visible');
  }
}

/**
 * Navigate to Settings page
 */
export async function navigateToSettings(page: Page): Promise<void> {
  // Settings might be in a profile menu or sidebar
  // Try multiple possible locations
  const settingsButton = page.getByRole('button', { name: /Settings/i });
  const settingsLink = page.getByRole('link', { name: /Settings/i });
  const settingsMenuItem = page.getByRole('menuitem', { name: /Settings/i });

  // Try each selector
  if ((await settingsButton.count()) > 0) {
    await settingsButton.click();
  } else if ((await settingsLink.count()) > 0) {
    await settingsLink.click();
  } else if ((await settingsMenuItem.count()) > 0) {
    await settingsMenuItem.click();
  } else {
    throw new Error('Settings button/link not found');
  }

  // Wait for settings page to load
  await page.waitForURL('**/settings', { timeout: 5000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for a thread to be created and appear in the list
 *
 * @param page - Playwright page object
 * @param titlePattern - Pattern to match thread title
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForThreadInList(
  page: Page,
  titlePattern: string | RegExp,
  timeout: number = 10000,
): Promise<void> {
  const threadItem = page.locator('div.thread-item', {
    hasText: typeof titlePattern === 'string' ? titlePattern : undefined,
  });

  await expect(threadItem).toBeVisible({ timeout });
}

/**
 * Open the "New Thread" creation flow
 */
export async function openNewThreadFlow(page: Page): Promise<void> {
  // Look for "New Thread" button - handle strict mode by using first()
  const newThreadButton = page.getByRole('button', { name: /new thread/i }).first();
  await expect(newThreadButton).toBeVisible({ timeout: 5000 });
  await newThreadButton.click();
  await page.waitForTimeout(500);

  // Wait for thread creation form
  await expect(page.locator('select#agent-select')).toBeVisible({ timeout: 5000 });
}

/**
 * Authenticate using test key (mock authentication)
 */
export async function authenticateWithTestKey(page: Page): Promise<void> {
  // Check if already authenticated
  const currentURL = page.url();
  if (currentURL.includes('/login')) {
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if ((await loginBtn.count()) > 0) {
      await expect(loginBtn).toBeVisible({ timeout: 5000 });
      await loginBtn.click();
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Retry logic for ensuring agents/models are loaded
 * If agents aren't loaded on first attempt, navigates through the app to trigger token refresh
 *
 * @param page - Playwright page object
 * @returns true if agents are available, false otherwise
 */
export async function ensureAgentsLoaded(page: Page): Promise<boolean> {
  const agentSelect = page.locator('select#agent-select');

  // First, wait for agent selector to be visible
  try {
    await expect(agentSelect).toBeVisible({ timeout: 50000 });
  } catch {
    // Agent selector not visible, might need to wait or navigate
    return false;
  }

  // Wait for options to be populated using expect
  console.log('[ensureAgentsLoaded] Waiting for agent options to populate...');
  try {
    await expect(agentSelect.locator('option')).not.toHaveCount(0, { timeout: 30000 });

    const agentCount = await agentSelect.locator('option').count();
    console.log(`[ensureAgentsLoaded] Found ${agentCount} agent options`);
    return agentCount > 0;
  } catch (error) {
    console.log('[ensureAgentsLoaded] Timeout waiting for options, trying navigation fallback...');
  }

  // If still no agents after wait, navigate to Home and back to force model loading
  console.log('[ensureAgentsLoaded] Navigating to Home to force model loading...');

  // Navigate to Home
  const homeMenuItem = page.getByRole('menuitem', { name: 'Home' });
  await homeMenuItem.click().catch(() => {});
  await page.waitForTimeout(3000);

  // Navigate back to Threads
  const threadsMenuItem = page.getByRole('menuitem', { name: 'Threads' });
  await threadsMenuItem.click().catch(() => {});
  await page.waitForTimeout(2000);

  // Check again after navigation
  try {
    await expect(agentSelect).toBeVisible({ timeout: 10000 });

    // Wait for options to populate after navigation
    await expect(agentSelect.locator('option')).not.toHaveCount(0, { timeout: 30000 });

    const agentCount = await agentSelect.locator('option').count();
    console.log(`[ensureAgentsLoaded] After navigation: Found ${agentCount} agent options`);
    return agentCount > 0;
  } catch {
    console.log('[ensureAgentsLoaded] Failed to load agents even after navigation');
    return false;
  }
}

/**
 * Force UI refresh by navigating to another thread and back
 * Useful when the app is in an error state and messages aren't appearing
 *
 * @param page - Playwright page object
 */
export async function forceThreadRefresh(page: Page): Promise<void> {
  console.log('[forceThreadRefresh] Forcing UI refresh...');

  // Get current URL to return to it
  const currentUrl = page.url();
  const currentThreadId = currentUrl.match(/threadId=([^&]+)/)?.[1];

  const threadList = page
    .locator('div.thread-item, [role="menuitem"]')
    .filter({ hasText: /\d+\/\d+/ });
  const threadCount = await threadList.count();

  if (threadCount > 1) {
    // Click to second thread
    console.log('[forceThreadRefresh] Navigating to second thread...');
    await threadList.nth(1).click();
    await page.waitForTimeout(1000);

    // Click back to original thread
    console.log('[forceThreadRefresh] Navigating back to original thread...');
    if (currentThreadId) {
      // Navigate back using URL to ensure we get to the right thread
      await page.goto(currentUrl);
      await page.waitForTimeout(1000);
    } else {
      // Fallback: click first thread
      await threadList.first().click();
      await page.waitForTimeout(1000);
    }
  } else {
    // Fallback: Navigate to threads list and back
    console.log('[forceThreadRefresh] Only one thread, navigating to list and back...');
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(500);

    if (currentThreadId) {
      await page.goto(currentUrl);
      await page.waitForTimeout(1000);
    } else {
      await threadList.first().click();
      await page.waitForTimeout(1000);
    }
  }

  // Ensure we're back in chat view
  const chatPane = page.locator('.chat-pane');
  await expect(chatPane).toBeVisible({ timeout: 5000 });

  console.log('[forceThreadRefresh] UI refresh complete');
}

/**
 * Wait for streaming to complete on a message
 */
export async function waitForStreamingComplete(page: Page, timeout: number = 60000): Promise<void> {
  try {
    await expect(page.locator('.messages .message.assistant.streaming')).toBeHidden({
      timeout,
    });
  } catch {
    // Fallback: just wait for assistant message to be visible
    const assistantMessages = page.locator('.messages .message.assistant .message-content');
    let isVisible = await assistantMessages
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!isVisible) {
      // If waiting too long, try navigating to homepage then back to threads and select thread again
      console.log(
        '[waitForStreamingComplete] Assistant message not visible, trying navigation recovery...',
      );

      // Get current thread URL to return to it
      const currentUrl = page.url();
      const threadIdMatch = currentUrl.match(/threadId=([^&]+)/);
      const threadId = threadIdMatch?.[1];

      // Navigate to Home
      await page.getByRole('menuitem', { name: 'Home' }).click();
      await page.waitForTimeout(1000);

      // Navigate to Threads
      await page.getByRole('menuitem', { name: 'Threads' }).click();
      await page.waitForTimeout(1000);

      // Find and click the thread again
      if (threadId) {
        // Try to navigate directly to the thread URL
        await page.goto(currentUrl);
        await page.waitForTimeout(2000);
      } else {
        // Fallback: click first thread
        const threadItem = page.locator('div.thread-item, [role="menuitem"]').first();
        if ((await threadItem.count()) > 0) {
          await threadItem.click();
          await page.waitForTimeout(2000);
        }
      }

      // Wait for chat pane to be visible
      const chatPane = page.locator('.chat-pane');
      await expect(chatPane).toBeVisible({ timeout: 10000 });

      // Wait for messages container
      const messagesContainer = page.locator('.messages');
      await expect(messagesContainer).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      // Check again for assistant message
      isVisible = await assistantMessages
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false);

      if (!isVisible) {
        // Final check - wait a bit more
        await page.waitForTimeout(2000);
        isVisible = await assistantMessages
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
      }
    }

    if (!isVisible) {
      // If still not visible, throw error
      throw new Error('Assistant message did not appear after streaming and recovery attempts');
    }

    await page.waitForTimeout(2000);
  }
}

/**
 * Optimization: Force UI refresh by clicking to another thread and back
 * This is much faster than waiting for streaming to complete
 *
 * @param page - Playwright page object
 * @deprecated Use forceThreadRefresh instead
 */
export async function forceThreadRefreshOld(page: Page): Promise<void> {
  const threadList = page.locator('div.thread-item');
  const threadCount = await threadList.count();

  if (threadCount > 1) {
    // Click to second thread
    await threadList.nth(1).click();
    await page.waitForTimeout(500);

    // Click back to first thread (our test thread)
    await threadList.first().click();
    await page.waitForTimeout(500);
  } else {
    // Fallback: wait for streaming to complete
    await page.waitForSelector('.message.assistant', { state: 'visible', timeout: 60000 });
    await page
      .waitForSelector('.message.assistant.streaming', { state: 'hidden', timeout: 60000 })
      .catch(() => {
        return page.waitForTimeout(2000);
      });
  }
}
