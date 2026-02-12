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

let app: ElectronApplication;
let page: Page;

test.describe.serial('Settings - Connections', () => {
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

    // Click Connections tab
    const connectionsItem = page.locator('.sidebar-item', { hasText: 'Connections' });
    await connectionsItem.click();
    await page.waitForTimeout(500);
  });

  test.afterAll(async () => {
    // Cancel any pending changes before closing
    try {
      const cancelBtn = page.locator('.settings-footer .btn-secondary');
      if (await cancelBtn.isEnabled()) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    } catch {
      // best-effort
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

    // Store original values to restore later
    const originalWeb = await mokuWebInput.inputValue();
    const originalApi = await mokuApiInput.inputValue();
    const originalHolo = await holoApiInput.inputValue();

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
    await page.waitForTimeout(500);

    // All three fields should be populated
    await expect(mokuWebInput).toHaveValue('https://web.example.com');
    await expect(mokuApiInput).toHaveValue('https://api.example.com');
    await expect(holoApiInput).toHaveValue('https://holo.example.com');

    // Cancel to restore original values
    const cancelBtn = page.locator('.settings-footer .btn-secondary');
    await cancelBtn.click();
    await page.waitForTimeout(500);
  });

  test('saving valid URLs shows success toast', async () => {
    // Requirement 15.3: saving valid connection URLs persists and shows success toast
    const mokuWebInput = page.locator('input#moku-web-url');
    const mokuApiInput = page.locator('input#moku-api-url');
    const holoApiInput = page.locator('input#holo-api-url');

    // Store originals
    const originalWeb = await mokuWebInput.inputValue();
    const originalApi = await mokuApiInput.inputValue();
    const originalHolo = await holoApiInput.inputValue();

    // Fill with valid URLs
    await mokuWebInput.fill('https://test-web.example.com');
    await mokuApiInput.fill('https://test-api.example.com');
    await holoApiInput.fill('https://test-holo.example.com');
    await page.waitForTimeout(500);

    // Save button should be enabled
    const saveBtn = page.locator('.settings-footer .btn-primary');
    await expect(saveBtn).toBeEnabled({ timeout: 3000 });

    // Click Save
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // Success toast should appear
    const toast = page.locator('.toast', { hasText: 'Settings were saved successfully' });
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Restore original URLs
    await mokuWebInput.fill(originalWeb);
    await mokuApiInput.fill(originalApi);
    await holoApiInput.fill(originalHolo);
    await page.waitForTimeout(300);

    // Save restored values (only if there are changes)
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }
  });
});
