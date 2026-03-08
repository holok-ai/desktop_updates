/**
 * App Updates E2E Tests
 *
 * Validates:
 * - "Check for Updates" from activity sidebar settings menu opens App Updates page
 * - App Updates page shows current version and latest version info
 * - Clicking Check Now triggers update check
 * - Toggling auto-check updates preference
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe.serial('App Updates', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');

    const settingsButton = page.locator('.settings-btn').first();
    await expect(settingsButton).toBeVisible({ timeout: 10000 });
    await settingsButton.click();

    const checkForUpdatesMenuItem = page.locator('.settings-menu .menu-item', {
      hasText: 'Check for Updates',
    });
    await expect(checkForUpdatesMenuItem).toBeVisible({ timeout: 5000 });
    await checkForUpdatesMenuItem.click();

    await expect(page).toHaveURL(/\/app-updates/, { timeout: 10000 });
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('app updates page shows current version and latest version info', async () => {
    const panelTitle = page.locator('h2.panel-title');
    await expect(panelTitle).toHaveText('App Updates');

    const versionRow = page.locator('.info-row', { hasText: 'Current Version' });
    await expect(versionRow).toBeVisible({ timeout: 5000 });
    const versionValue = versionRow.locator('.info-value');
    const versionText = await versionValue.textContent();
    expect(versionText?.trim().length).toBeGreaterThan(0);

    const latestRow = page.locator('.info-row', { hasText: 'Available Version' });
    await expect(latestRow).toBeVisible({ timeout: 5000 });
    const latestValue = latestRow.locator('.info-value');
    const latestText = await latestValue.textContent();
    expect(latestText?.trim().length).toBeGreaterThan(0);
  });

  test('clicking Check Now triggers update check', async () => {
    const checkBtn = page.locator('.btn-primary', { hasText: 'Check Now' });
    await expect(checkBtn).toBeVisible({ timeout: 5000 });
    await expect(checkBtn).toBeEnabled();

    await checkBtn.click();

    const toast = page.locator('.toast').first();
    await expect(toast).toBeVisible({ timeout: 10000 });
  });

  test('toggling auto-check updates preference', async () => {
    const autoCheckLabel = page.locator('label', {
      hasText: 'Check for updates on startup',
    });
    const autoCheckbox = autoCheckLabel.locator('input[type="checkbox"]');

    await expect(autoCheckbox).toBeVisible({ timeout: 5000 });

    const initialChecked = await autoCheckbox.isChecked();

    await autoCheckbox.click();
    await expect(autoCheckbox).toBeChecked({ checked: !initialChecked, timeout: 3000 });

    await autoCheckbox.click();
    await expect(autoCheckbox).toBeChecked({ checked: initialChecked, timeout: 3000 });
  });
});
