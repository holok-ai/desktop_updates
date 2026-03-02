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
import {
  navigateToSettings,
  clickSettingsTab,
  saveSettings,
  cancelSettings,
} from '../fixtures/settings-helpers';

let app: ElectronApplication;
let page: Page;
let originalAvatarType: 'Letters' | 'Icon' | 'Image' = 'Letters';

test.describe.serial('Settings - General', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');

    // Navigate to Settings page via UI
    await navigateToSettings(page);

    // Detect the current avatar type so we can restore it in afterAll
    const avatarPreview = page.locator('.avatar-preview');
    await expect(avatarPreview).toBeVisible({ timeout: 5000 });
    if (
      await avatarPreview
        .locator('.avatar-icon-display')
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      originalAvatarType = 'Icon';
    } else if (
      await avatarPreview
        .locator('.avatar-image')
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      originalAvatarType = 'Image';
    } else {
      originalAvatarType = 'Letters';
    }
  });

  test.afterAll(async () => {
    // Restore avatar type to original value
    try {
      // Ensure we're on the General settings tab
      const settingsPage = page.locator('.settings-page');
      if (!(await settingsPage.isVisible({ timeout: 2000 }).catch(() => false))) {
        await navigateToSettings(page);
      }
      await clickSettingsTab(page, 'General');

      // Click the original avatar type card to restore it
      const originalCard = page.locator('.card-grid-3 .option-card', {
        hasText: originalAvatarType,
      });
      await originalCard.click();

      // Save the restored setting
      const saveBtn = page.locator('.settings-footer .btn-primary');
      const isEnabled = await saveBtn.isEnabled({ timeout: 1000 }).catch(() => false);
      if (isEnabled) {
        await saveSettings(page);
      }
    } catch {
      // Best-effort restoration — don't fail teardown
    }

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
    const avatarPreview = page.locator('.avatar-preview');
    await expect(avatarPreview).toBeVisible({ timeout: 5000 });

    // Initially should show letters avatar
    const avatarLetters = avatarPreview.locator('.avatar-letters');
    await expect(avatarLetters).toBeVisible({ timeout: 5000 });

    // Click "Icon" avatar type card
    const iconCard = page.locator('.card-grid-3 .option-card', { hasText: 'Icon' });
    await iconCard.click();

    // Preview should now show icon
    const avatarIcon = avatarPreview.locator('.avatar-icon-display');
    await expect(avatarIcon).toBeVisible({ timeout: 5000 });

    // Click "Letters" to revert back
    const lettersCard = page.locator('.card-grid-3 .option-card', { hasText: 'Letters' });
    await lettersCard.click();

    // Preview should show letters again
    await expect(avatarPreview.locator('.avatar-letters')).toBeVisible({ timeout: 5000 });
  });

  test('saving settings shows success toast', async () => {
    // Requirement 11.3: saving settings persists and shows success toast
    // Make a change: switch avatar to Icon type
    const iconCard = page.locator('.card-grid-3 .option-card', { hasText: 'Icon' });
    await iconCard.click();

    // Wait for the Icon preview to confirm the UI reacted to the click
    const avatarPreview = page.locator('.avatar-preview');
    await expect(avatarPreview.locator('.avatar-icon-display')).toBeVisible({ timeout: 5000 });

    // Save using shared helper (clicks Save, waits for toast, waits for button disabled)
    await saveSettings(page);
  });

  test('canceling settings reverts changes', async () => {
    // Requirement 11.4: canceling reverts to last saved state
    // Current saved state is "Icon" from previous test
    // Switch to "Letters"
    const lettersCard = page.locator('.card-grid-3 .option-card', { hasText: 'Letters' });
    await lettersCard.click();

    // Wait for the Letters preview to confirm the UI reacted
    const avatarPreview = page.locator('.avatar-preview');
    await expect(avatarPreview.locator('.avatar-letters')).toBeVisible({ timeout: 5000 });

    // Cancel using shared helper (clicks Cancel, waits for button disabled)
    await cancelSettings(page);

    // Avatar should revert to Icon (the last saved state)
    await expect(avatarPreview.locator('.avatar-icon-display')).toBeVisible({ timeout: 5000 });

    // Revert to Letters and save for clean state
    await lettersCard.click();
    await expect(avatarPreview.locator('.avatar-letters')).toBeVisible({ timeout: 5000 });
    await saveSettings(page);
  });

  test('invalid URL shows validation error', async () => {
    // Requirement 11.5: invalid URL in connection fields shows validation error
    // Navigate to Connections tab using shared helper
    await clickSettingsTab(page, 'Connections');

    // Verify Connections panel is shown
    const panelTitle = page.locator('h2.panel-title');
    await expect(panelTitle).toHaveText('Connections');

    // Enter an invalid URL in the Holo API URL field
    const holoInput = page.locator('input#holo-api-url');
    await expect(holoInput).toBeVisible({ timeout: 5000 });
    await holoInput.fill('not-a-valid-url');

    // Validation error should appear
    const errorText = page.locator('.error-text');
    await expect(errorText).toBeVisible({ timeout: 5000 });
    await expect(errorText).toContainText('Invalid Holo API URL');

    // Cancel to revert changes using shared helper
    await cancelSettings(page);
  });
});
