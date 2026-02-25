/**
 * Settings Diagnostics E2E Tests
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Settings Diagnostics', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Navigate to Settings page (same pattern as other settings tests)
    await page.evaluate(() => {
      window.location.hash = '#/settings';
    });
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('navigating to Settings and clicking Diagnostics shows the Diagnostics panel with heading', async () => {
    // Verify settings page loaded
    const settingsPage = page.locator('.settings-page');
    await expect(settingsPage).toBeVisible({ timeout: 10000 });

    // Click the Diagnostics sidebar item
    const diagnosticsItem = page.locator('.sidebar-item', { hasText: 'Diagnostics' });
    await expect(diagnosticsItem).toBeVisible({ timeout: 5000 });
    await diagnosticsItem.click();
    await page.waitForTimeout(1000);

    // Verify the panel title shows "Diagnostics"
    const panelTitle = page.locator('h2.panel-title');
    await expect(panelTitle).toBeVisible({ timeout: 10000 });
    await expect(panelTitle).toHaveText('Diagnostics');
  });

  test('Diagnostics panel shows "Application Log" section with "View Log" button', async () => {
    const appLogLabel = page.locator('.subgroup-label', { hasText: 'Application Log' });
    await expect(appLogLabel).toBeVisible({ timeout: 5000 });

    const viewLogButton = page.locator('.btn-primary', { hasText: 'View Log' });
    await expect(viewLogButton).toBeVisible({ timeout: 5000 });
  });

  test('clicking "View Log" button is functional and does not crash the app', async () => {
    const viewLogButton = page.locator('.btn-primary', { hasText: 'View Log' });
    await expect(viewLogButton).toBeEnabled({ timeout: 5000 });

    await viewLogButton.click();
    await page.waitForTimeout(1000);

    // Verify the settings page is still visible (no crash)
    const settingsPage = page.locator('.settings-page');
    await expect(settingsPage).toBeVisible({ timeout: 5000 });
  });
});
