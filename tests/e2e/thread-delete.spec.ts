/**
 * Thread Delete E2E Tests
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4 (Thread Delete)
 * - Clicking Delete Thread opens delete modal with title and warning
 * - Confirming delete removes thread from list and shows toast
 * - Cancel closes modal without deleting
 * - Escape closes modal without deleting
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import {
  openFirstThreadContextMenu,
  clickDangerMenuItem,
  navigateToThreads,
  createThreadViaUI,
} from '../fixtures/thread-context-menu-helpers';
import { navigateToSettings, clickSettingsTab, saveSettings } from '../fixtures/settings-helpers';

let app: ElectronApplication;
let page: Page;

/** Enable or disable the delete confirmation setting via the Settings UI. */
async function setDeleteConfirmation(pg: Page, enabled: boolean) {
  await navigateToSettings(pg);
  await clickSettingsTab(pg, 'General');

  // The UI has separate checkboxes for threads and projects
  const threadLabel = pg.locator('label', {
    hasText: 'Require confirmation to delete threads?',
  });
  const checkbox = threadLabel.locator('input[type="checkbox"]');
  await expect(checkbox).toBeVisible({ timeout: 5000 });

  const isChecked = await checkbox.isChecked();
  const needsChange = (enabled && !isChecked) || (!enabled && isChecked);

  if (!needsChange) {
    return;
  }

  if (enabled) {
    await checkbox.check();
  } else {
    await checkbox.uncheck();
  }

  await saveSettings(pg);

  // Wait for toast to auto-dismiss before continuing
  const toast = pg.locator('.toast[role="alert"]');
  await toast.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
}

/** Open the delete modal on the first thread item. */
async function openDeleteModal(pg: Page) {
  await openFirstThreadContextMenu(pg);
  await clickDangerMenuItem(pg, 'Delete Thread');

  const dialog = pg.locator('[role="dialog"][aria-labelledby="delete-dialog-title"]');
  await expect(dialog).toBeVisible({ timeout: 5000 });
  return dialog;
}

test.describe.serial('Thread Delete', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');

    // Wait for the app shell to be fully rendered
    const sidebar = page.locator('button[aria-label="Threads"]');
    await expect(sidebar).toBeVisible({ timeout: 15000 });
  });

  test.afterAll(async () => {
    // Restore deleteConfirmation to default (off) so other tests aren't affected
    try {
      if (page && !page.isClosed()) {
        await setDeleteConfirmation(page, false);
      }
    } catch {
      // Best-effort restoration — don't fail teardown
    }
    await app?.close();
  });

  test('verify delete confirmation is on', async () => {
    await setDeleteConfirmation(page, true);
  });

  test('create a fresh thread for delete tests', async () => {
    await createThreadViaUI(page);
    await navigateToThreads(page);

    const threadItems = page.locator('.thread-item-container');
    await expect(threadItems.first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking Delete Thread opens delete modal with thread title and warning', async () => {
    // Requirement 3.1
    const firstItem = page.locator('.thread-item-container').first();
    const threadTitle = await firstItem.locator('.thread-item-title').textContent();

    const dialog = await openDeleteModal(page);

    await expect(dialog.locator('#delete-dialog-title')).toHaveText('Delete Thread');

    const warningText = dialog.locator('.warning-text');
    await expect(warningText).toBeVisible({ timeout: 3000 });
    await expect(warningText).toContainText(threadTitle!.trim(), { timeout: 3000 });
    await expect(dialog.locator('.warning-subtext')).toBeVisible({ timeout: 3000 });

    // Close the modal via Cancel
    await dialog.locator('button.btn-secondary').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('clicking Cancel in delete modal closes without deleting', async () => {
    // Requirement 3.3
    const threadItems = page.locator('.thread-item-container');
    const countBefore = await threadItems.count();

    const dialog = await openDeleteModal(page);

    await dialog.locator('button.btn-secondary').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const countAfter = await threadItems.count();
    expect(countAfter).toBe(countBefore);
  });

  test('pressing Escape in delete modal closes without deleting', async () => {
    // Requirement 3.4
    const threadItems = page.locator('.thread-item-container');
    const countBefore = await threadItems.count();

    await openDeleteModal(page);

    await page.keyboard.press('Escape');

    const dialog = page.locator('[role="dialog"][aria-labelledby="delete-dialog-title"]');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const countAfter = await threadItems.count();
    expect(countAfter).toBe(countBefore);
  });

  test('clicking Delete Thread in modal removes thread from list and shows toast', async () => {
    // Requirement 3.2
    const threadItems = page.locator('.thread-item-container');
    const countBefore = await threadItems.count();

    const dialog = await openDeleteModal(page);

    await dialog.locator('button.btn-danger').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const toast = page.locator('.toast[role="alert"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText('Thread deleted successfully', { timeout: 3000 });

    // Wait for the thread list to update after deletion
    await expect(threadItems).toHaveCount(countBefore - 1, { timeout: 10000 });
  });
});
