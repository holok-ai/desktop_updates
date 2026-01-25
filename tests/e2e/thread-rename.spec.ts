import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { navigateToHome } from '../helpers/ui-helpers';

async function navigateToThreadsPage(page: Page): Promise<void> {
  // Ensure we're on the Threads view so the sidebar thread list is visible
  const threadsMenuItem = page.getByRole('menuitem', { name: 'Threads' });
  if ((await threadsMenuItem.count()) > 0) {
    await threadsMenuItem.click();
    await page.waitForTimeout(300);
  }
}

test.describe('E2E: Thread Rename (simple)', () => {
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

  test('rename first thread from sidebar context menu', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Already authenticated - no login needed!
    // First navigate to home to load models (wait 30s)
    await navigateToHome(page);

    // Then navigate to threads page
    await navigateToThreadsPage(page);

    // Dismiss any modal overlays that might be blocking interactions
    const modalOverlay = page.locator('.modal-overlay');
    if (await modalOverlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Try to close modal by pressing Escape or clicking overlay
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Check if threads exist, if not create one
    const noThreadsMessage = page.locator('text=No threads available yet.');
    const hasNoThreads = await noThreadsMessage.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasNoThreads) {
      // Create a thread first
      const newThreadButton = page.getByRole('button', { name: /new thread/i }).first();
      await newThreadButton.click();
      await page.waitForTimeout(500);

      // Fill in prompt
      const promptTextarea = page.locator('textarea#thread-prompt');
      await expect(promptTextarea).toBeVisible({ timeout: 5000 });
      await promptTextarea.fill(`Test Thread for Rename ${Date.now()}`);
      await promptTextarea.press('Enter');
      await page.waitForTimeout(2000);

      // Navigate back to threads
      await page.getByRole('menuitem', { name: 'Threads' }).click();
      await page.waitForTimeout(500);
    }

    // Find first thread item (div.thread-item)
    const firstThread = page.locator('div.thread-item').first();
    await expect(firstThread).toBeVisible({ timeout: 5000 });

    // Wait a bit for any animations/modals to settle
    await page.waitForTimeout(1000);

    // Dismiss any modal overlays by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Hover over thread to make action buttons visible
    await firstThread.hover();
    await page.waitForTimeout(300);

    // Click the Edit button
    const editButton = firstThread.locator('button.action-button.edit');
    await expect(editButton).toBeVisible({ timeout: 3000 });
    await editButton.click();
    await page.waitForTimeout(500);

    // Wait for rename modal to appear
    const renameDialog = page.locator('[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(renameDialog).toBeVisible({ timeout: 2000 });

    // Enter new title (use timestamp to ensure it's unique and different from original)
    const newTitle = `Renamed Thread ${Date.now()}`;
    const titleInput = page.locator('input#thread-title');
    await expect(titleInput).toBeVisible();
    await titleInput.clear();
    await titleInput.fill(newTitle);

    // Wait for validation to enable the button
    await page.waitForTimeout(300);

    // Save the rename
    const saveButton = page.getByRole('button', { name: 'Rename' });
    await expect(saveButton).toBeEnabled({ timeout: 3000 });
    await saveButton.click();

    // Wait for modal to close
    await renameDialog.waitFor({ state: 'detached', timeout: 5000 });

    // Verify title updated in sidebar
    await expect(page.locator('div.thread-item').filter({ hasText: newTitle })).toBeVisible({
      timeout: 4000,
    });
  });
});
