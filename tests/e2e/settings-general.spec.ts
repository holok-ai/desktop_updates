/**
 * Settings - General E2E Tests
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5
 * - Settings page shows General tab by default with app version
 * - Modifying avatar type updates preview
 * - Saving settings shows success toast
 * - Canceling settings reverts changes
 * - Invalid URL shows validation error
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Settings - General', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Navigate to Settings page
    await page.evaluate(() => {
      window.location.hash = '#/settings';
    });
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('settings page shows General tab by default with app version', async () => {
    // Requirement 11.1: General tab displayed by default with app version
    const settingsPage = page.locator('.settings-page');
    await expect(settingsPage).toBeVisible({ timeout: 10000 });

    // General sidebar item should be active
    const generalItem = page.locator('.sidebar-item.active');
    await expect(generalItem).toBeVisible({ timeout: 5000 });
    await expect(generalItem).toContainText('General');

    // Panel title should say "General"
    const panelTitle = page.locator('h2.panel-title');
    await expect(panelTitle).toBeVisible({ timeout: 5000 });
    await expect(panelTitle).toHaveText('General');

    // App version should be displayed
    const versionRow = page.locator('.info-row', { hasText: 'Version' });
    await expect(versionRow).toBeVisible({ timeout: 5000 });
    const versionValue = versionRow.locator('.info-value');
    await expect(versionValue).toBeVisible();
    const versionText = await versionValue.textContent();
    expect(versionText?.trim().length).toBeGreaterThan(0);
  });

  test('modifying avatar type updates preview', async () => {
    // Requirement 11.2: modifying avatar type updates the preview
    // Default avatar type should be "Letters" with preview showing letters
    const avatarPreview = page.locator('.avatar-preview');
    await expect(avatarPreview).toBeVisible({ timeout: 5000 });

    // Initially should show letters avatar
    const avatarLetters = avatarPreview.locator('.avatar-letters');
    await expect(avatarLetters).toBeVisible({ timeout: 5000 });

    // Click "Icon" avatar type card
    const iconCard = page.locator('.card-grid-3 .option-card', { hasText: 'Icon' });
    await iconCard.click();
    await page.waitForTimeout(500);

    // Preview should now show icon
    const avatarIcon = avatarPreview.locator('.avatar-icon-display');
    await expect(avatarIcon).toBeVisible({ timeout: 5000 });

    // Click "Letters" to revert back
    const lettersCard = page.locator('.card-grid-3 .option-card', { hasText: 'Letters' });
    await lettersCard.click();
    await page.waitForTimeout(500);

    // Preview should show letters again
    await expect(avatarPreview.locator('.avatar-letters')).toBeVisible({ timeout: 5000 });
  });

  test('saving settings shows success toast', async () => {
    // Requirement 11.3: saving settings persists and shows success toast
    // Make a change: switch avatar to Icon type
    const iconCard = page.locator('.card-grid-3 .option-card', { hasText: 'Icon' });
    await iconCard.click();
    await page.waitForTimeout(500);

    // Save button should be enabled now
    const saveBtn = page.locator('.settings-footer .btn-primary');
    await expect(saveBtn).toBeEnabled({ timeout: 3000 });

    // Click Save
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // Success toast should appear
    const toast = page.locator('.toast', { hasText: 'Settings were saved successfully' });
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Save button should be disabled again (no pending changes)
    await expect(saveBtn).toBeDisabled({ timeout: 5000 });
  });

  test('canceling settings reverts changes', async () => {
    // Requirement 11.4: canceling reverts to last saved state
    // Current saved state is "Icon" from previous test
    // Switch to "Letters"
    const lettersCard = page.locator('.card-grid-3 .option-card', { hasText: 'Letters' });
    await lettersCard.click();
    await page.waitForTimeout(500);

    // Cancel button should be enabled
    const cancelBtn = page.locator('.settings-footer .btn-secondary');
    await expect(cancelBtn).toBeEnabled({ timeout: 3000 });

    // Click Cancel
    await cancelBtn.click();
    await page.waitForTimeout(500);

    // Avatar should revert to Icon (the last saved state)
    const avatarPreview = page.locator('.avatar-preview');
    const avatarIcon = avatarPreview.locator('.avatar-icon-display');
    await expect(avatarIcon).toBeVisible({ timeout: 5000 });

    // Cancel button should be disabled again
    await expect(cancelBtn).toBeDisabled({ timeout: 3000 });

    // Revert to Letters and save for clean state
    await lettersCard.click();
    await page.waitForTimeout(500);
    const saveBtn = page.locator('.settings-footer .btn-primary');
    await saveBtn.click();
    await page.waitForTimeout(2000);
  });

  test('invalid URL shows validation error', async () => {
    // Requirement 11.5: invalid URL in connection fields shows validation error
    // Navigate to Connections tab
    const connectionsItem = page.locator('.sidebar-item', { hasText: 'Connections' });
    await connectionsItem.click();
    await page.waitForTimeout(500);

    // Verify Connections panel is shown
    const panelTitle = page.locator('h2.panel-title');
    await expect(panelTitle).toHaveText('Connections');

    // Enter an invalid URL in the Holo API URL field
    const holoInput = page.locator('input#holo-api-url');
    await expect(holoInput).toBeVisible({ timeout: 5000 });
    await holoInput.fill('not-a-valid-url');
    await page.waitForTimeout(500);

    // Validation error should appear
    const errorText = page.locator('.error-text');
    await expect(errorText).toBeVisible({ timeout: 5000 });
    await expect(errorText).toContainText('Invalid Holo API URL');

    // Cancel to revert changes
    const cancelBtn = page.locator('.settings-footer .btn-secondary');
    await cancelBtn.click();
    await page.waitForTimeout(500);
  });
});
