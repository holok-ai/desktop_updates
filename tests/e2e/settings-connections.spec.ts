/**
 * Settings - Connections E2E Tests
 *
 * Validates: Requirements 15.1, 15.2, 15.3
 * - Connections tab shows URL input fields
 * - Multi-line paste auto-populates all URL fields
 * - Saving valid URLs shows success toast
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

// Store original connection URLs dynamically so afterAll can restore them
let originalWebUrl = '';
let originalApiUrl = '';
let originalHoloUrl = '';

test.describe.serial('Settings - Connections', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');

    // Navigate to Settings page via UI
    await navigateToSettings(page);

    // Click Connections tab via shared helper
    await clickSettingsTab(page, 'Connections');

    // Read and store original connection URLs for restoration in afterAll
    const mokuWebInput = page.locator('input#moku-web-url');
    const mokuApiInput = page.locator('input#moku-api-url');
    const holoApiInput = page.locator('input#holo-api-url');

    await expect(mokuWebInput).toBeVisible({ timeout: 5000 });
    originalWebUrl = await mokuWebInput.inputValue();
    originalApiUrl = await mokuApiInput.inputValue();
    originalHoloUrl = await holoApiInput.inputValue();
  });

  test.afterAll(async () => {
    // Restore connection URLs to their original values
    try {
      const settingsPage = page.locator('.settings-page');
      if (!(await settingsPage.isVisible({ timeout: 2000 }).catch(() => false))) {
        await navigateToSettings(page);
      }
      await clickSettingsTab(page, 'Connections');

      const mokuWebInput = page.locator('input#moku-web-url');
      const mokuApiInput = page.locator('input#moku-api-url');
      const holoApiInput = page.locator('input#holo-api-url');

      await mokuWebInput.fill(originalWebUrl);
      await mokuApiInput.fill(originalApiUrl);
      await holoApiInput.fill(originalHoloUrl);

      const saveBtn = page.locator('.settings-footer .btn-primary');
      if (await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveSettings(page);
      }
    } catch {
      // Best-effort restoration — don't fail teardown
    }

    await app?.close();
  });

  test('connections tab shows URL input fields', async () => {
    // Requirement 15.1: displays input fields for all three URLs
    const panelTitle = page.locator('h2.panel-title');
    await expect(panelTitle).toHaveText('Connections');

    const mokuWebInput = page.locator('input#moku-web-url');
    await expect(mokuWebInput).toBeVisible({ timeout: 5000 });

    const mokuApiInput = page.locator('input#moku-api-url');
    await expect(mokuApiInput).toBeVisible({ timeout: 5000 });

    const holoApiInput = page.locator('input#holo-api-url');
    await expect(holoApiInput).toBeVisible({ timeout: 5000 });
  });

  test('multi-line paste auto-populates all URL fields', async () => {
    // Requirement 15.2: pasting multi-line text into Moku Web URL auto-fills all 3 fields
    const mokuWebInput = page.locator('input#moku-web-url');
    const mokuApiInput = page.locator('input#moku-api-url');
    const holoApiInput = page.locator('input#holo-api-url');

    // Simulate multi-line paste via clipboard API
    const pasteText = 'https://web.example.com\nhttps://api.example.com\nhttps://holo.example.com';

    await mokuWebInput.focus();
    await page.evaluate((text) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      });
      document.querySelector('#moku-web-url')?.dispatchEvent(pasteEvent);
    }, pasteText);

    // All three fields should be populated with the pasted URLs
    await expect(mokuWebInput).toHaveValue('https://web.example.com', { timeout: 3000 });
    await expect(mokuApiInput).toHaveValue('https://api.example.com', { timeout: 3000 });
    await expect(holoApiInput).toHaveValue('https://holo.example.com', { timeout: 3000 });

    // Cancel to restore original values using shared helper
    await cancelSettings(page);
  });

  test('saving valid URLs shows success toast', async () => {
    // Requirement 15.3: saving valid connection URLs persists and shows success toast
    const mokuWebInput = page.locator('input#moku-web-url');
    const mokuApiInput = page.locator('input#moku-api-url');
    const holoApiInput = page.locator('input#holo-api-url');

    // Fill with valid test URLs
    await mokuWebInput.fill('https://test-web.example.com');
    await mokuApiInput.fill('https://test-api.example.com');
    await holoApiInput.fill('https://test-holo.example.com');

    // Save using shared helper (clicks Save, waits for toast, waits for button disabled)
    await saveSettings(page);

    // Restore original URLs so afterAll doesn't need to do extra work
    await mokuWebInput.fill(originalWebUrl);
    await mokuApiInput.fill(originalApiUrl);
    await holoApiInput.fill(originalHoloUrl);

    const saveBtn = page.locator('.settings-footer .btn-primary');
    if (await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
      await saveSettings(page);
    }
  });
});
