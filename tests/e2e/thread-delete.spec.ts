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
  openThreadContextMenuByThreadId,
  clickDangerMenuItem,
  navigateToThreads,
  createThreadViaUI,
} from '../fixtures/thread-context-menu-helpers';
import { navigateToSettings, clickSettingsTab, saveSettings } from '../fixtures/settings-helpers';
import {
  getAppStateCounts,
  expectAppStateUnchanged,
  type AppStateCounts,
} from '../fixtures/state-helpers';
import { deleteThreadsByPrefix } from '../helpers/cleanup-helpers';
import { E2E_THREAD_PREFIX } from '../helpers/e2e-constants';

let app: ElectronApplication;
let page: Page;

/** Thread id of the thread created in "create a fresh thread for delete tests" — used so we only delete that thread. */
let createdThreadId: string | null = null;
let initialCounts: AppStateCounts | null = null;

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

/** Open the delete modal on the thread with the given id (only removes that thread). */
async function openDeleteModalForThread(pg: Page, threadId: string) {
  await openThreadContextMenuByThreadId(pg, threadId);
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

    // Capture initial global state snapshot for sanity check
    initialCounts = await getAppStateCounts(page);
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

    if (page && !page.isClosed()) {
      // Sanity check: suites that create + delete their own thread should
      // leave global counts unchanged.
      if (initialCounts) {
        const finalCounts = await getAppStateCounts(page);
        expectAppStateUnchanged(initialCounts, finalCounts, 'Thread Delete suite');
      }

      await deleteThreadsByPrefix(page, E2E_THREAD_PREFIX);
    }

    await app?.close();
  });

  test('verify delete confirmation is on', async () => {
    await setDeleteConfirmation(page, true);
  });

  test('create a fresh thread for delete tests', async () => {
    await createThreadViaUI(page);
    const url = page.url();
    const match = /threadId=([^&]+)/.exec(url);
    if (match) createdThreadId = match[1];
    await navigateToThreads(page);

    const threadItems = page.locator('.thread-item-container');
    await expect(threadItems.first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking Delete Thread opens delete modal with thread title and warning', async () => {
    // Requirement 3.1 — target only the thread we created
    expect(createdThreadId).toBeTruthy();
    const item = page.locator(`.thread-item-container[data-thread-id="${createdThreadId}"]`);
    const threadTitle = await item.locator('.thread-item-title').textContent();

    const dialog = await openDeleteModalForThread(page, createdThreadId!);

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
    // Requirement 3.3 — target only the thread we created
    expect(createdThreadId).toBeTruthy();
    const threadItems = page.locator('.thread-item-container');
    const countBefore = await threadItems.count();

    const dialog = await openDeleteModalForThread(page, createdThreadId!);

    await dialog.locator('button.btn-secondary').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const countAfter = await threadItems.count();
    expect(countAfter).toBe(countBefore);
  });

  test('pressing Escape in delete modal closes without deleting', async () => {
    // Requirement 3.4 — target only the thread we created
    expect(createdThreadId).toBeTruthy();
    const threadItems = page.locator('.thread-item-container');
    const countBefore = await threadItems.count();

    await openDeleteModalForThread(page, createdThreadId!);

    await page.keyboard.press('Escape');

    const dialog = page.locator('[role="dialog"][aria-labelledby="delete-dialog-title"]');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const countAfter = await threadItems.count();
    expect(countAfter).toBe(countBefore);
  });

  test('clicking Delete Thread in modal removes thread from list and shows toast', async () => {
    // Requirement 3.2 — delete only the thread we created
    expect(createdThreadId).toBeTruthy();
    const threadItems = page.locator('.thread-item-container');
    const countBefore = await threadItems.count();

    const dialog = await openDeleteModalForThread(page, createdThreadId!);

    await dialog.locator('button.btn-danger').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const toast = page.locator('.toast[role="alert"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText('Thread deleted successfully', { timeout: 3000 });

    // Wait for the thread list to update after deletion
    await expect(threadItems).toHaveCount(countBefore - 1, { timeout: 10000 });
  });
});
