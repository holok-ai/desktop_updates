/**
 * Thread Rename E2E Tests
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7 (Thread Rename)
 * - Clicking Rename opens modal with current title pre-filled
 * - Modifying title enables Rename button; clicking Rename updates title
 * - Cancel / close button dismisses without changing title
 * - Empty or unchanged title keeps Rename button disabled
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import {
  openFirstThreadContextMenu,
  clickMenuItem,
  navigateToThreads,
  createThreadViaUI,
} from '../fixtures/thread-context-menu-helpers';
import { deleteThreadsByPrefix } from '../helpers/cleanup-helpers';
import { E2E_THREAD_PREFIX, E2E_RENAMED_THREAD_PREFIX } from '../helpers/e2e-constants';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Thread Rename', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    // Wait for the app shell to be fully rendered after launch
    await expect(page.locator('.app-layout')).toBeVisible({ timeout: 10000 });

    await navigateToThreads(page);

    // Create a dedicated test thread so we don't rename user data
    await createThreadViaUI(page);
    await navigateToThreads(page);

    // Wait for thread items to appear after navigation (including workaround)
    const threadItems = page.locator('.thread-item-container');
    try {
      await threadItems.first().waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      throw new Error('No threads available for rename tests');
    }

    const count = await threadItems.count();
    if (count === 0) {
      throw new Error('No threads available for rename tests');
    }
  });

  test.afterAll(async () => {
    if (page && !page.isClosed()) {
      await deleteThreadsByPrefix(page, E2E_THREAD_PREFIX);
      await deleteThreadsByPrefix(page, E2E_RENAMED_THREAD_PREFIX);
    }

    await app?.close();
  });

  test('clicking Rename opens modal with current title pre-filled and input focused', async () => {
    // Requirements 2.1, 2.2
    const firstItem = page.locator('.thread-item-container').first();
    const originalTitle = await firstItem.locator('.thread-item-title').textContent();

    await openFirstThreadContextMenu(page);
    await clickMenuItem(page, 'Rename');

    const dialog = page.locator('[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('#rename-dialog-title')).toHaveText('Rename Thread');

    const titleInput = dialog.locator('#thread-title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await expect(titleInput).toHaveValue(originalTitle!.trim());
    await expect(titleInput).toBeFocused({ timeout: 3000 });

    await dialog.locator('button.btn-secondary').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('modifying title to valid value enables Rename button; clicking Rename updates title and shows toast', async () => {
    // Requirements 2.3, 2.4
    await openFirstThreadContextMenu(page);
    await clickMenuItem(page, 'Rename');

    const dialog = page.locator('[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const titleInput = dialog.locator('#thread-title');
    const renameButton = dialog.locator('button.btn-primary[type="submit"]');

    await expect(renameButton).toBeDisabled({ timeout: 3000 });

    const newTitle = `Renamed E2E ${Date.now()}`;
    await titleInput.click({ clickCount: 3 });
    await titleInput.pressSequentially(newTitle, { delay: 20 });

    await expect(renameButton).toBeEnabled({ timeout: 5000 });
    await renameButton.click();

    // The rename API call is async — modal stays open until the parent handler resolves.
    // If the API hangs, close the modal manually so subsequent tests aren't blocked.
    try {
      await expect(dialog).not.toBeVisible({ timeout: 45000 });
    } catch {
      // API timed out — try closing the modal via close button or cancel
      const closeBtn = dialog.locator('button[aria-label="Close dialog"]');
      const cancelBtn = dialog.locator('button.btn-secondary');
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      } else if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
      }
      await expect(dialog)
        .not.toBeVisible({ timeout: 5000 })
        .catch(() => {});
      // Re-throw so the test still reports failure
      throw new Error('Rename API call timed out after 45s — modal did not close');
    }

    const toast = page.locator('.toast[role="alert"]');
    await expect(toast).toBeVisible({ timeout: 15000 });
    await expect(toast).toContainText('Thread renamed', { timeout: 5000 });

    const updatedItem = page.locator('.thread-item-container').first();
    await expect(updatedItem.locator('.thread-item-title')).toContainText(newTitle, {
      timeout: 5000,
    });

    await page
      .locator('.toast[role="alert"]')
      .waitFor({ state: 'hidden', timeout: 10000 })
      .catch(() => {});
  });

  test('clicking Cancel in rename modal closes without changing title', async () => {
    // Requirement 2.5
    const firstItem = page.locator('.thread-item-container').first();
    const originalTitle = await firstItem.locator('.thread-item-title').textContent();

    await openFirstThreadContextMenu(page);
    await clickMenuItem(page, 'Rename');

    const dialog = page.locator('[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const titleInput = dialog.locator('#thread-title');
    await titleInput.clear();
    await titleInput.fill('Should Not Be Saved');

    await dialog.locator('button.btn-secondary').click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const currentTitle = await firstItem.locator('.thread-item-title').textContent();
    expect(currentTitle!.trim()).toBe(originalTitle!.trim());
  });

  test('closing rename modal via close button dismisses without changing title', async () => {
    // Requirement 2.6
    const firstItem = page.locator('.thread-item-container').first();
    const originalTitle = await firstItem.locator('.thread-item-title').textContent();

    await openFirstThreadContextMenu(page);
    await clickMenuItem(page, 'Rename');

    const dialog = page.locator('[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const titleInput = dialog.locator('#thread-title');
    await titleInput.clear();
    await titleInput.fill('Should Not Be Saved Either');

    await dialog.locator('button[aria-label="Close dialog"]').click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const currentTitle = await firstItem.locator('.thread-item-title').textContent();
    expect(currentTitle!.trim()).toBe(originalTitle!.trim());
  });

  test('empty or unchanged title keeps Rename button disabled', async () => {
    // Requirement 2.7
    await openFirstThreadContextMenu(page);
    await clickMenuItem(page, 'Rename');

    const dialog = page.locator('[role="dialog"][aria-labelledby="rename-dialog-title"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const titleInput = dialog.locator('#thread-title');
    const renameButton = dialog.locator('button.btn-primary[type="submit"]');

    await expect(renameButton).toBeDisabled({ timeout: 3000 });

    await titleInput.clear();
    await expect(renameButton).toBeDisabled({ timeout: 3000 });

    await titleInput.fill('   ');
    await expect(renameButton).toBeDisabled({ timeout: 3000 });

    await dialog.locator('button.btn-secondary').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});
