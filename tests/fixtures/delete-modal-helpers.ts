/**
 * Shared Delete Modal Helper Functions for E2E Tests
 *
 * Extracts the duplicated delete confirmation modal handling pattern
 * from project-list.spec.ts and project-thread.spec.ts into a
 * reusable helper.
 *
 * The delete confirmation modal may or may not appear depending on
 * the user's `deleteConfirmationRequired` setting. This helper
 * handles both cases gracefully.
 *
 * Used by: project-list, project-thread spec files.
 */

import { expect } from '@playwright/test';
import type { Page } from 'playwright';

/** Selector for the delete confirmation dialog. */
const DELETE_MODAL_SELECTOR = 'div[role="dialog"][aria-labelledby="delete-dialog-title"]';

/**
 * Handle a delete confirmation modal — confirm or cancel.
 *
 * When `deleteConfirmationRequired` is enabled the app shows a modal
 * after a delete action is triggered. When it is disabled the delete
 * happens immediately without a modal.
 *
 * This helper checks whether the modal appeared and, if so, clicks
 * the appropriate button:
 *   - `'confirm'` — clicks the danger (red) confirm button and waits
 *     for the modal to close.
 *   - `'cancel'`  — clicks the secondary cancel button and waits for
 *     the modal to close.
 *
 * If the modal does not appear within a short timeout the function
 * returns silently, assuming the delete proceeded without confirmation.
 *
 * @param page   - Playwright Page object
 * @param action - `'confirm'` to accept the deletion, `'cancel'` to dismiss
 */
export async function handleDeleteModal(page: Page, action: 'confirm' | 'cancel'): Promise<void> {
  const deleteModal = page.locator(DELETE_MODAL_SELECTOR);

  // The modal may or may not appear depending on the user setting.
  // Wait briefly for it to show up; if it doesn't, the delete already
  // went through without confirmation.
  const modalVisible = await deleteModal.isVisible({ timeout: 2000 }).catch(() => false);

  if (!modalVisible) {
    return;
  }

  if (action === 'confirm') {
    const confirmBtn = deleteModal.locator('button.btn-danger');
    await expect(confirmBtn).toBeVisible({ timeout: 3000 });
    await confirmBtn.click();
  } else {
    const cancelBtn = deleteModal.locator('button.btn-secondary');
    await expect(cancelBtn).toBeVisible({ timeout: 3000 });
    await cancelBtn.click();
  }

  // Wait for the modal to close after the action
  await expect(deleteModal).not.toBeVisible({ timeout: 10000 });
}
