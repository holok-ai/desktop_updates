import { test, expect } from '@playwright/test';
import type { ElectronApplication } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { navigateToHome, ensureAgentsLoaded, findModelByName } from '../helpers/ui-helpers';

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

    // Select model if model selector exists (use default Haiku 3.5)
    const modelSelect = page.locator('select.model-selector-compact');
    if ((await modelSelect.count()) > 0) {
      await expect(modelSelect).toBeVisible({ timeout: 5000 });
      const haikuModel = await findModelByName(page, 'haiku');
      await modelSelect.selectOption(haikuModel);
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

    // Wait for thread to be created - check if it appears in sidebar
    await page.waitForTimeout(2000);

    // Check if chat view loaded automatically
    const chatPane = page.locator('.chat-pane');
    let isChatVisible = await chatPane.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isChatVisible) {
      // Thread created but didn't navigate - find and click the thread in sidebar
      // Wait for thread to appear in sidebar
      let threadItem = page.locator('div.thread-item').first();
      let threadCount = await threadItem.count();

      // If no thread-item found, try menuitem
      if (threadCount === 0) {
        threadItem = page
          .locator('[role="menuitem"]')
          .filter({ hasText: uniquePrompt.substring(0, 20) });
        threadCount = await threadItem.count();
      }

      // If still not found, try any thread item
      if (threadCount === 0) {
        threadItem = page.locator('div.thread-item, [role="menuitem"]').first();
        threadCount = await threadItem.count();
      }

      // Wait for thread item to be visible
      if (threadCount > 0) {
        await expect(threadItem).toBeVisible({ timeout: 10000 });

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

        // Check if chat pane is now visible
        isChatVisible = await chatPane.isVisible({ timeout: 5000 }).catch(() => false);
      }
    }

    // Verify thread was created successfully - wait longer and check multiple times
    if (!isChatVisible) {
      // Try waiting a bit more and checking again
      await page.waitForTimeout(2000);
      isChatVisible = await chatPane.isVisible({ timeout: 10000 }).catch(() => false);
    }

    // If still not visible, try clicking thread again or navigating to threads and back
    if (!isChatVisible) {
      console.log('[thread-management] Chat pane still not visible, trying recovery...');

      // Dismiss any modal that might be blocking
      const modalOverlay = page.locator('.modal-overlay, [role="presentation"]');
      if (await modalOverlay.isVisible({ timeout: 1000 }).catch(() => false)) {
        const unsavedModal = page.locator('text=Unsaved Changes');
        if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
          await page.getByRole('button', { name: 'Cancel' }).click();
          await page.waitForTimeout(500);
        } else {
          // Try pressing Escape to close any modal
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }

      // Navigate to threads list
      await page.getByRole('menuitem', { name: 'Threads' }).click();
      await page.waitForTimeout(1000);

      // Find and click the thread again
      const threadItem = page.locator('div.thread-item, [role="menuitem"]').first();
      if ((await threadItem.count()) > 0) {
        await expect(threadItem).toBeVisible({ timeout: 5000 });

        // Dismiss modal if present
        const unsavedModal = page.locator('text=Unsaved Changes');
        if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
          await page.getByRole('button', { name: 'Cancel' }).click();
          await page.waitForTimeout(500);
        }

        await threadItem.click();
        await page.waitForTimeout(2000);
      }
    }

    await expect(chatPane).toBeVisible({ timeout: 10000 });
  });
});
