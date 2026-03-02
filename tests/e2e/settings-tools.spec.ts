/**
 * Settings - Tools E2E Tests
 *
 * Validates: Requirements 14.1, 14.2, 14.3
 * - Tools tab shows available tools with toggles
 * - Toggling a tool updates enabled list
 * - File tools whitelist is displayed
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { navigateToSettings, clickSettingsTab } from '../fixtures/settings-helpers';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Settings - Tools', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');

    // Navigate to Settings page via UI (replaces window.location.hash)
    await navigateToSettings(page);

    // Click Tools tab using shared helper
    await clickSettingsTab(page, 'Tools');
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('tools tab shows available tools with toggles', async () => {
    // Requirement 14.1: displays list of available tools with toggle switches
    const panelTitle = page.locator('h2.panel-title');
    await expect(panelTitle).toHaveText('Tools');

    // Tools list should be visible
    const toolsList = page.locator('.tools-list');
    await expect(toolsList).toBeVisible({ timeout: 5000 });

    // Should have tool items with checkboxes
    const toolItems = toolsList.locator('.tool-item');
    const count = await toolItems.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Each tool item should have a checkbox
    const firstCheckbox = toolItems.first().locator('input[type="checkbox"]');
    await expect(firstCheckbox).toBeVisible({ timeout: 3000 });
  });

  test('toggling a tool updates enabled list', async () => {
    // Requirement 14.2: toggling a tool on/off updates the enabled tools list
    const toolsList = page.locator('.tools-list');
    const firstToolItem = toolsList.locator('.tool-item').first();
    const checkbox = firstToolItem.locator('input[type="checkbox"]');

    // Get initial state
    const initialChecked = await checkbox.isChecked();

    // Toggle and verify state changed
    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: !initialChecked, timeout: 3000 });

    // Toggle back to restore original state
    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: initialChecked, timeout: 3000 });
  });

  test('file tools whitelist is displayed', async () => {
    // Requirement 14.3: file tools whitelist configuration is shown
    const allowedDirsLabel = page.locator('.subgroup-label', { hasText: 'Allowed Directories' });
    await expect(allowedDirsLabel).toBeVisible({ timeout: 5000 });

    // The FileToolsWhitelist component should be rendered in its subgroup
    const allowedDirsSection = page.locator('.subgroup-row', { hasText: 'Allowed Directories' });
    await expect(allowedDirsSection).toBeVisible({ timeout: 5000 });
  });
});
