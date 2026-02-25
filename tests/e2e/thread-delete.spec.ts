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

let app: ElectronApplication;
let page: Page;

/** Enable or disable the delete confirmation setting via the Settings UI. */
async function setDeleteConfirmation(page: Page, enabled: boolean) {
  await page.evaluate(() => {
    window.location.hash = '#/settings';
  });
  await page.waitForTimeout(2000);

  const generalItem = page.locator('.sidebar-item', { hasText: 'General' });
  await generalItem.click();
  await page.waitForTimeout(1000);

  const confirmationLabel = page.locator('label', {
    hasText: 'Require confirmation to delete threads and projects',
  });
  const checkbox = confirmationLabel.locator('input[type="checkbox"]');
  await expect(checkbox).toBeVisible({ timeout: 5000 });

  const isChecked = await checkbox.isChecked();
  const needsChange = (enabled && !isChecked) || (!enabled && isChecked);

  if (!needsChange) {
    // Already in desired state, nothing to save
    return;
  }

  if (enabled) {
    await checkbox.check();
  } else {
    await checkbox.uncheck();
  }
  await page.waitForTimeout(500);

  const saveButton = page.locator('button.btn-primary', { hasText: 'Save' });
  await saveButton.click();
  await page.waitForTimeout(1000);

  // Wait for toast to clear
  const toast = page.locator('.toast[role="alert"]');
  if (await toast.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.waitForTimeout(3000);
  }
}

/** Open the delete modal on the first thread item. */
async function openDeleteModal(page: Page) {
  await openFirstThreadContextMenu(page);
  await clickDangerMenuItem(page, 'Delete Thread');

  const dialog = page.locator('[role="dialog"][aria-labelledby="delete-dialog-title"]');
  await expect(dialog).toBeVisible({ timeout: 5000 });
  return dialog;
}

test.describe.serial('Thread Delete', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('verify delete confirmation is on', async () => {
    await setDeleteConfirmation(page, true);
  });

  test('create a fresh thread for delete tests', async () => {
    await createThreadViaUI(page);
    await navigateToThreads(page);

    const threadItems = page.locator('.thread-item-container');
    const count = await threadItems.count();
    expect(count).toBeGreaterThan(0);
    await page.waitForTimeout(2000);
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

    await dialog.locator('button.btn-secondary').click();
    await page.waitForTimeout(300);
  });

  test('clicking Cancel in delete modal closes without deleting', async () => {
    // Requirement 3.3
    const threadItems = page.locator('.thread-item-container');
    const countBefore = await threadItems.count();

    const dialog = await openDeleteModal(page);

    await dialog.locator('button.btn-secondary').click();
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(1000);

    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const toast = page.locator('.toast[role="alert"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText('Thread deleted successfully', { timeout: 3000 });

    await page.waitForTimeout(1000);
    const countAfter = await threadItems.count();
    expect(countAfter).toBe(countBefore - 1);

    // Restore default setting
    await setDeleteConfirmation(page, false);
    await navigateToThreads(page);
  });
});
