/**
 * Shared UI Helper Functions for E2E Tests
 *
 * These helpers abstract UI interactions to make tests more maintainable
 * and resilient to UI changes.
 */

import { Page, expect } from '@playwright/test';

/**
 * Navigate to Home page and wait for models to load
 * This is required before navigating to Threads to ensure models are loaded
 */
export async function navigateToHome(page: Page): Promise<void> {
  const homeMenuItem = page.getByRole('menuitem', { name: 'Home' });
  await expect(homeMenuItem).toBeVisible({ timeout: 10000 });
  await homeMenuItem.click();

  // Wait for home page to load
  await page.waitForLoadState('networkidle');

  // Wait 60 seconds for models to load on homepage
  await page.waitForTimeout(60000);
}

/**
 * Navigate to Threads page and wait for it to load
 * Note: Should call navigateToHome() first to ensure models are loaded
 */
export async function navigateToThreads(page: Page): Promise<void> {
  // Check if we're in a chat view - if so, we need to navigate to threads list first
  const currentUrl = page.url();
  const isInChatView = currentUrl.includes('/chat/');

  if (isInChatView) {
    // We're in a chat view, click Threads to go to threads list
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(500);

    // Wait for URL to change away from chat view
    await page.waitForFunction(() => !window.location.href.includes('/chat/'), { timeout: 10000 });
  } else {
    // Not in chat view, just click Threads
    await page.getByRole('menuitem', { name: 'Threads' }).click();
  }

  // Wait for URL to contain /threads
  await page.waitForFunction(() => window.location.href.includes('/threads'), { timeout: 10000 });

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

  // Wait for home page to load
  await page.waitForLoadState('networkidle');

  // Wait 60 seconds for models to load on homepage
  await page.waitForTimeout(60000);
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
  await expect(agentSelect).toBeVisible({ timeout: 60000 });

  // Select agent if specified, otherwise select first agent
  if (agentId) {
    await agentSelect.selectOption(agentId);
  } else {
    // Select first agent to ensure models load
    const firstOption = await agentSelect.locator('option').first();
    const firstValue = await firstOption.getAttribute('value');
    if (firstValue) {
      await agentSelect.selectOption(firstValue);
    }
  }

  // Wait for models to load after agent selection
  await page.waitForTimeout(1000);

  // Select model if specified and model selector exists
  const modelSelect = page.locator('select.model-selector-compact');
  const modelCount = await modelSelect.count();

  if (modelCount > 0) {
    await expect(modelSelect).toBeVisible({ timeout: 50000 });

    // Default to Claude Opus 4 if no model specified
    const targetModelId = modelId || 'claude-opus-4-20250514';

    try {
      // Try to select the target model by value
      await modelSelect.selectOption(targetModelId);
      console.log(`✓ Selected model: ${targetModelId}`);
    } catch (error) {
      console.warn(`⚠ Failed to select model ${targetModelId}, trying fallback...`);

      // Fallback: try to find any Opus 4 model by text
      const opus4Option = modelSelect.locator('option').filter({ hasText: /opus.*4/i });
      if ((await opus4Option.count()) > 0) {
        const opus4Value = await opus4Option.first().getAttribute('value');
        if (opus4Value) {
          await modelSelect.selectOption(opus4Value);
          console.log(`✓ Selected fallback model: ${opus4Value}`);
        }
      } else {
        // Last resort: select first model
        const firstModelOption = await modelSelect.locator('option').first();
        const firstModelValue = await firstModelOption.getAttribute('value');
        if (firstModelValue) {
          await modelSelect.selectOption(firstModelValue);
          console.log(`✓ Selected first available model: ${firstModelValue}`);
        }
      }
    }

    await page.waitForTimeout(500);
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
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="message-input"]') as HTMLTextAreaElement;
      return el && !el.disabled;
    },
    undefined, // No arguments to pass to the function
    { timeout: 120000 }, // 2 minutes for AI response to complete
  );
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
    !currentUrl.includes('/chat');

  if (isFirstCall) {
    await navigateToHome(page);
  }

  // If we're in a chat view, explicitly navigate to threads first
  if (currentUrl.includes('/chat/')) {
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(1000);
  }

  // Navigate to threads page
  await navigateToThreads(page);

  // Dismiss any "Unsaved Changes" dialog
  const dismissDialog = async () => {
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    if ((await cancelButton.count()) > 0 && (await cancelButton.isVisible())) {
      await cancelButton.click();
      await page.waitForTimeout(300);
    }
  };
  await dismissDialog();

  // Check if agent selector is already visible (we're on the creation form)
  const agentSelect = page.locator('select#agent-select');
  const isAgentSelectVisible = await agentSelect.isVisible({ timeout: 2000 }).catch(() => false);

  if (!isAgentSelectVisible) {
    // Agent selector not visible - we need to click "New Thread" button
    // Use the button with "Create new thread" text from the error context
    const newThreadButton = page
      .getByRole('button', { name: /create new thread|new thread/i })
      .first();
    await expect(newThreadButton).toBeVisible({ timeout: 5000 });

    // Force click in case button is in an unusual state
    await newThreadButton.click({ force: true });
    await page.waitForTimeout(1500); // Wait longer for form to appear
    await dismissDialog();

    // Now wait for agent selector to appear
    await expect(agentSelect).toBeVisible({ timeout: 10000 });
  }

  // Select agent/model - always select agent and Claude Opus 4 by default
  await selectAgentAndModel(page, agentId, modelId);

  // Fill prompt
  const promptTextarea = page.locator('textarea#thread-prompt');
  await expect(promptTextarea).toBeVisible({ timeout: 5000 });
  await promptTextarea.fill(prompt);

  // Submit by pressing Enter (UI hint says "Press Enter to send")
  await promptTextarea.press('Enter');
  await page.waitForTimeout(1000);
  await dismissDialog();

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
    await threadItem.click();
    await page.waitForTimeout(1000);
  }

  // Wait for chat view to be fully loaded
  await expect(chatPane).toBeVisible({ timeout: 10000 });
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

  // Get available agents - retry if empty (may need token refresh)
  let agentOptions = agentSelect.locator('option');
  let agentCount = await agentOptions.count();

  // Retry logic: If no agents loaded, navigate around to trigger refresh
  if (agentCount === 0) {
    console.log('[E2E] No agents loaded, attempting navigation retry...');

    // Navigate to home
    await page.click('a[href="#/"]').catch(() => {});
    await page.waitForTimeout(1000);

    // Navigate to projects
    await page.click('a[href="#/projects"]').catch(() => {});
    await page.waitForTimeout(1000);

    // Navigate back to threads
    await navigateToThreads(page);
    await page.waitForTimeout(2000);

    // Check again
    await expect(agentSelect).toBeVisible({ timeout: 50000 });
    agentOptions = agentSelect.locator('option');
    agentCount = await agentOptions.count();

    // If still no agents, wait longer for token refresh to complete
    if (agentCount === 0) {
      console.log('[E2E] Still no agents, waiting 30s for token refresh...');
      await page.waitForTimeout(30000);
      agentOptions = agentSelect.locator('option');
      agentCount = await agentOptions.count();
    }
  }

  return agentCount > 0;
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
    await expect(assistantMessages.first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(2000);
  }
}

/**
 * Optimization: Force UI refresh by clicking to another thread and back
 * This is much faster than waiting for streaming to complete
 *
 * @param page - Playwright page object
 */
export async function forceThreadRefresh(page: Page): Promise<void> {
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
