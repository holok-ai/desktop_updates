/**
 * Shared Settings Helper Functions for E2E Tests
 *
 * Extracts duplicated settings navigation, tab selection, save, and
 * cancel patterns from the six settings spec files into reusable helpers.
 *
 * Replaces all `page.evaluate(() => { window.location.hash = '#/settings' })`
 * calls with UI-driven navigation via the user avatar menu.
 *
 * Used by: settings-general, settings-appearance, settings-connections,
 *          settings-diagnostics, settings-tools spec files.
 */

import { expect } from '@playwright/test';
import type { Page } from 'playwright';

/**
 * Navigate to the Settings page by clicking the settings UI element.
 *
 * Clicks the sidebar Settings button to open its context menu, then
 * clicks the "Settings" menu item to navigate to the settings page.
 *
 * Replaces all `page.evaluate(() => { window.location.hash = '#/settings' })` calls.
 *
 * @param page - Playwright Page object
 */
export async function navigateToSettings(page: Page): Promise<void> {
  // Click the Settings button in the sidebar to open the context menu
  const settingsBtn = page.locator('.settings-btn');
  await expect(settingsBtn).toBeVisible({ timeout: 10000 });
  await settingsBtn.click();

  // Click the Settings menu item from the context menu
  const settingsMenuItem = page.locator('.settings-menu .menu-item', { hasText: 'Settings' });
  await expect(settingsMenuItem).toBeVisible({ timeout: 5000 });
  await settingsMenuItem.click();

  // Wait for the settings page to be fully rendered
  const settingsPage = page.locator('.settings-page');
  await expect(settingsPage).toBeVisible({ timeout: 10000 });
}

/**
 * Click a settings sidebar tab by label text.
 *
 * Clicks the sidebar button matching the given tab name and waits for
 * the corresponding panel title to appear.
 *
 * @param page - Playwright Page object
 * @param tabName - The tab label: 'General', 'Appearance', 'Tools', 'Connections', or 'Diagnostics'
 */
export async function clickSettingsTab(page: Page, tabName: string): Promise<void> {
  const tabButton = page.locator('button.sidebar-item', { hasText: tabName });
  await expect(tabButton).toBeVisible({ timeout: 5000 });
  await tabButton.click();

  // Wait for the panel title to reflect the selected tab
  const panelTitle = page.locator('h2.panel-title');
  await expect(panelTitle).toHaveText(tabName, { timeout: 5000 });
}

/**
 * Click the Save button in the settings footer and wait for the success toast.
 *
 * Expects the Save button to be enabled (i.e., there are pending changes).
 *
 * @param page - Playwright Page object
 */
export async function saveSettings(page: Page): Promise<void> {
  const saveBtn = page.locator('.settings-footer .btn-primary');
  await expect(saveBtn).toBeEnabled({ timeout: 3000 });
  await saveBtn.click();

  // Wait for the success toast to appear
  const toast = page.locator('.toast', { hasText: 'Settings were saved successfully' });
  await expect(toast).toBeVisible({ timeout: 5000 });

  // Wait for the Save button to become disabled (changes persisted)
  await expect(saveBtn).toBeDisabled({ timeout: 5000 });
}

/**
 * Click the Cancel button in the settings footer.
 *
 * Expects the Cancel button to be enabled (i.e., there are pending changes).
 * Waits for the button to become disabled after cancellation (changes reverted).
 *
 * @param page - Playwright Page object
 */
export async function cancelSettings(page: Page): Promise<void> {
  const cancelBtn = page.locator('.settings-footer .btn-secondary');
  await expect(cancelBtn).toBeEnabled({ timeout: 3000 });
  await cancelBtn.click();

  // Wait for the Cancel button to become disabled (changes reverted)
  await expect(cancelBtn).toBeDisabled({ timeout: 3000 });
}
