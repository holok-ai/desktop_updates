/**
 * Settings - Updates E2E Tests
 *
 * Validates: Requirements 13.1, 13.2, 13.3
 * - Updates tab shows current version and latest version info
 * - Clicking Check Now triggers update check
 * - Toggling auto-check updates preference
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { navigateToSettings, clickSettingsTab } from '../fixtures/settings-helpers';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Settings - Updates', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');

    // Navigate to Settings page via UI (replaces window.location.hash)
    await navigateToSettings(page);

    // Click Updates tab using shared helper
    await clickSettingsTab(page, 'Updates');
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('updates tab shows current version and latest version info', async () => {
    // Requirement 13.1: displays current version and update info
    const panelTitle = page.locator('h2.panel-title');
    await expect(panelTitle).toHaveText('Updates');

    // Current Version row
    const versionRow = page.locator('.info-row', { hasText: 'Current Version' });
    await expect(versionRow).toBeVisible({ timeout: 5000 });
    const versionValue = versionRow.locator('.info-value');
    const versionText = await versionValue.textContent();
    expect(versionText?.trim().length).toBeGreaterThan(0);

    // Latest Version row (shows version, "Not Available In Development", or "—")
    const latestRow = page.locator('.info-row', { hasText: 'Available Version' });
    await expect(latestRow).toBeVisible({ timeout: 5000 });
    const latestValue = latestRow.locator('.info-value');
    const latestText = await latestValue.textContent();
    expect(latestText?.trim().length).toBeGreaterThan(0);
  });

  test('clicking Check Now triggers update check', async () => {
    // Requirement 13.2: Check Now triggers update check and shows toast
    const checkBtn = page.locator('.btn-primary', { hasText: 'Check Now' });
    await expect(checkBtn).toBeVisible({ timeout: 5000 });
    await expect(checkBtn).toBeEnabled();

    await checkBtn.click();

    // A toast should appear (success or error depending on network)
    const toast = page.locator('.toast').first();
    await expect(toast).toBeVisible({ timeout: 10000 });
  });

  test('toggling auto-check updates preference', async () => {
    // Requirement 13.3: toggling auto-check updates the preference
    // The actual UI uses labels with text "Check for updates on startup?"
    const autoCheckLabel = page.locator('label', {
      hasText: 'Check for updates on startup',
    });
    const autoCheckbox = autoCheckLabel.locator('input[type="checkbox"]');

    await expect(autoCheckbox).toBeVisible({ timeout: 5000 });

    // Get initial state
    const initialChecked = await autoCheckbox.isChecked();

    // Toggle and verify state changed
    await autoCheckbox.click();
    await expect(autoCheckbox).toBeChecked({ checked: !initialChecked, timeout: 3000 });

    // Toggle back to restore original state
    await autoCheckbox.click();
    await expect(autoCheckbox).toBeChecked({ checked: initialChecked, timeout: 3000 });
  });
});
