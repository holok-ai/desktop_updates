import { test, expect, type ElectronApplication } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { navigateToHome, ensureAgentsLoaded } from '../helpers/ui-helpers';

test.describe('E2E: Thread management', () => {
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

  // No beforeEach cleanup; test is resilient to persisted auth state
  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('Create flow via dual sidebar', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Already authenticated - no login needed!
    // First navigate to home to load models (wait 30s)
    await navigateToHome(page);

    // Navigate to Threads via main sidebar (menuitem)
    await page.getByRole('menuitem', { name: 'Threads' }).click();

    // Wait for the threads page to load
    await page.waitForTimeout(1000);

    // Dismiss any "Unsaved Changes" dialog that might appear
    const dismissUnsavedDialog = async () => {
      const cancelButton = page.getByRole('button', { name: 'Cancel' });
      if ((await cancelButton.count()) > 0 && (await cancelButton.isVisible())) {
        await cancelButton.click();
        await page.waitForTimeout(300);
      }
    };

    await dismissUnsavedDialog();

    // Check if we're on the thread list or creation form
    const createButton = page.getByRole('button', { name: /new thread/i }).first();
    if ((await createButton.count()) > 0 && (await createButton.isVisible())) {
      // We're on the thread list, click "New Thread" button
      await createButton.click();
      await page.waitForTimeout(500);
    }

    // Wait for agent selector to be visible
    const agentSelect = page.locator('select#agent-select');
    await expect(agentSelect).toBeVisible({ timeout: 50000 });

    // Ensure agents are loaded (with retry logic)
    const agentsAvailable = await ensureAgentsLoaded(page);
    expect(agentsAvailable).toBe(true);

    // Select the first agent if available
    const options = await agentSelect.locator('option').count();
    if (options > 0) {
      await agentSelect.selectOption({ index: 0 });
      await page.waitForTimeout(500);
    }

    // Select Claude Opus 4 model if model selector exists
    const modelSelect = page.locator('select.model-selector-compact');
    if ((await modelSelect.count()) > 0) {
      await expect(modelSelect).toBeVisible({ timeout: 5000 });
      await modelSelect.selectOption('claude-opus-4-20250514');
      await page.waitForTimeout(500);
    }

    // Fill in the prompt with unique identifier
    const uniquePrompt = `Playwright Thread ${Date.now()}`;
    const promptTextarea = page.locator('textarea#thread-prompt');
    await expect(promptTextarea).toBeVisible({ timeout: 3000 });
    await promptTextarea.fill(uniquePrompt);
    await page.waitForTimeout(300);

    // Submit by pressing Enter (as indicated by the UI hint)
    await promptTextarea.press('Enter');
    await page.waitForTimeout(500);

    // Dismiss any unsaved changes dialog
    await dismissUnsavedDialog();

    // Wait for thread to be created
    await page.waitForTimeout(2000);

    // Check if chat view loaded automatically
    const chatPane = page.locator('.chat-pane');
    const isChatVisible = await chatPane.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isChatVisible) {
      // Thread created but didn't navigate - click the thread in sidebar
      const threadItem = page.locator('div.thread-item').first();
      await expect(threadItem).toBeVisible({ timeout: 5000 });
      
      // Dismiss any "Unsaved Changes" modal that might be blocking
      const unsavedModal = page.locator('text=Unsaved Changes');
      if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.getByRole('button', { name: 'Cancel' }).click();
        await page.waitForTimeout(500);
      }
      
      await threadItem.click();
      await page.waitForTimeout(2000);
      
      // Wait for URL to change or chat pane to appear
      try {
        await page.waitForFunction(() => window.location.href.includes('threadId='), {
          timeout: 10000,
        });
      } catch {
        // URL might not change, just wait for chat pane
      }
    }

    // Verify thread was created successfully - wait longer and check multiple times
    let chatPaneVisible = await chatPane.isVisible({ timeout: 10000 }).catch(() => false);
    
    if (!chatPaneVisible) {
      // Try waiting a bit more and checking again
      await page.waitForTimeout(2000);
      chatPaneVisible = await chatPane.isVisible({ timeout: 10000 }).catch(() => false);
    }
    
    await expect(chatPane).toBeVisible({ timeout: 10000 });
  });
});
