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

    // Dismiss any "Unsaved Changes" modal that might be blocking
    const unsavedModal = page.locator('text=Unsaved Changes');
    if (await unsavedModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[thread-rename] Dismissing unsaved changes modal...');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    }

    // Also check for modal overlay and dismiss it
    const modalOverlay = page.locator('.modal-overlay, [role="presentation"]');
    if (await modalOverlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Try to close modal by pressing Escape or clicking Cancel button
      const cancelButton = page.getByRole('button', { name: 'Cancel' });
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500);
    }

    // Wait for threads list to load
    await page.waitForTimeout(1000);

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

    // Find first thread item - try multiple selectors
    let firstThread = page.locator('div.thread-item').first();
    let threadCount = await firstThread.count();
    
    // If no div.thread-item found, try menuitem
    if (threadCount === 0) {
      firstThread = page
        .locator('[role="menuitem"]')
        .filter({ hasNotText: /^(Home|Threads|Projects|Settings)$/i })
        .first();
      threadCount = await firstThread.count();
    }
    
    // Wait for thread item to be visible
    if (threadCount === 0) {
      // Wait a bit more for threads to load
      await page.waitForTimeout(2000);
      firstThread = page.locator('div.thread-item, [role="menuitem"]').first();
      threadCount = await firstThread.count();
    }
    
    await expect(firstThread).toBeVisible({ timeout: 10000 });

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
    
    // Click the save button and wait for it to process
    await saveButton.click();
    
    // Wait for the rename to complete - check if dialog closes or if title updates
    // Try waiting for dialog to be hidden first (faster than detached)
    let dialogClosed = false;
    try {
      await renameDialog.waitFor({ state: 'hidden', timeout: 5000 });
      dialogClosed = true;
    } catch {
      // Dialog might still be visible, try detached
      try {
        await renameDialog.waitFor({ state: 'detached', timeout: 5000 });
        dialogClosed = true;
      } catch {
        // Dialog still not closed, check if rename succeeded anyway
        console.log('[thread-rename] Dialog did not close, checking if rename succeeded...');
      }
    }
    
    // If dialog didn't close, try alternative methods
    if (!dialogClosed) {
      const isStillVisible = await renameDialog.isVisible({ timeout: 1000 }).catch(() => false);
      if (isStillVisible) {
        // Check if there's an error message
        const errorMessage = page.locator('.error, .error-message, [role="alert"]');
        const hasError = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);
        if (hasError) {
          const errorText = await errorMessage.textContent();
          console.log('[thread-rename] Error message found:', errorText);
        }
        
        // Try pressing Enter as fallback
        console.log('[thread-rename] Dialog still visible, trying Enter key...');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        // Check again
        const stillVisible = await renameDialog.isVisible({ timeout: 1000 }).catch(() => false);
        if (stillVisible) {
          // Try Escape
          console.log('[thread-rename] Dialog still visible, trying Escape...');
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
    }
    
    // Wait a bit for any async operations to complete
    await page.waitForTimeout(1000);

    // Wait for sidebar to update - try multiple approaches
    let titleUpdated = false;
    let retries = 0;
    const maxRetries = 5;
    
    while (!titleUpdated && retries < maxRetries) {
      // Check if title is visible in sidebar
      const threadItemWithNewTitle = page.locator('div.thread-item').filter({ hasText: newTitle });
      titleUpdated = await threadItemWithNewTitle.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (!titleUpdated) {
        retries++;
        console.log(`[thread-rename] Title not updated yet, retry ${retries}/${maxRetries}...`);
        
        if (retries < maxRetries) {
          // Try navigating away and back to refresh sidebar
          if (retries === 2) {
            console.log('[thread-rename] Navigating to Home and back to refresh sidebar...');
            await page.getByRole('menuitem', { name: 'Home' }).click();
            await page.waitForTimeout(1000);
            await page.getByRole('menuitem', { name: 'Threads' }).click();
            await page.waitForTimeout(1000);
          } else if (retries === 4) {
            // Last resort: reload the page
            console.log('[thread-rename] Reloading page to refresh sidebar...');
            await page.reload();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            
            // Navigate to threads
            await page.getByRole('menuitem', { name: 'Threads' }).click();
            await page.waitForTimeout(1000);
          } else {
            // Just wait a bit more
            await page.waitForTimeout(1000);
          }
        }
      }
    }

    // Verify title updated in sidebar
    if (!titleUpdated) {
      // Try alternative selector - maybe it's a menuitem
      const altThreadItem = page.locator('[role="menuitem"]').filter({ hasText: newTitle });
      titleUpdated = await altThreadItem.isVisible({ timeout: 5000 }).catch(() => false);
    }
    
    await expect(page.locator('div.thread-item, [role="menuitem"]').filter({ hasText: newTitle })).toBeVisible({
      timeout: 5000,
    });
  });
});
