/**
 * E2E helper for tests/data/ and allowed-folders setup.
 *
 * Call addTestDataFolderToAllowedFolders(page) in beforeAll/beforeEach to register
 * tests/data/ as an allowed directory via the app's settings UI, so file tools
 * can read from tests/data/ during E2E tests.
 */

import { expect } from '@playwright/test';
import type { Page } from 'playwright';
export { getTestDataFolderPath } from '../../helpers/testDataFolder.js';
import {
  navigateToSettings,
  clickSettingsTab,
  saveSettings,
} from '../../fixtures/settings-helpers.js';
import { getTestDataFolderPath } from './testDataFolder.js';

/**
 * Adds the tests/data/ folder to the allowed directories list via the app's
 * Settings → Tools UI, then saves. Navigates to Settings and the Tools tab
 * if needed. Call in beforeAll or beforeEach when E2E tests need file tools
 * to access tests/data/.
 */
export async function addTestDataFolderToAllowedFolders(page: Page): Promise<void> {
  const dataPath = getTestDataFolderPath();

  await navigateToSettings(page);
  await clickSettingsTab(page, 'Tools');

  const pathInput = page.locator('.whitelist-section input[type="text"]').first();
  await expect(pathInput).toBeVisible({ timeout: 5000 });
  await pathInput.fill(dataPath);

  const addBtn = page.locator('.whitelist-section button', { hasText: 'Add' }).first();
  await expect(addBtn).toBeVisible({ timeout: 3000 });
  await addBtn.click();

  await saveSettings(page);
}
