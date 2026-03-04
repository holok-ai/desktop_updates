/**
 * Settings - Appearance E2E Tests
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 * - Appearance tab shows Sidebar Options, Theme, Thread Format
 * - Selecting theme immediately applies it
 * - Changing startup page reflects in UI (navigates to General tab)
 * - Toggling sidebar options updates checkboxes
 * - Adjusting chat text size slider shows value
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import { navigateToSettings, clickSettingsTab } from '../fixtures/settings-helpers';

let app: ElectronApplication;
let page: Page;
let originalTheme: string = 'Light';
let originalStartupPage: string = '';

test.describe.serial('Settings - Appearance', () => {
  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
    page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');

    // Navigate to Settings page via UI
    await navigateToSettings(page);

    // Click Appearance tab via shared helper
    await clickSettingsTab(page, 'Appearance');

    // Store original theme for restoration in afterAll
    const themeSection = page.locator('.subgroup-row', { hasText: 'Theme' });
    const activeThemeCard = themeSection.locator('.option-card.active');
    await expect(activeThemeCard).toBeVisible({ timeout: 5000 });
    const themeLabel = await activeThemeCard.locator('.option-card-label').textContent();
    originalTheme = themeLabel?.trim() || 'Light';

    // Store original startup page for restoration in afterAll
    await clickSettingsTab(page, 'General');
    const startupSection = page.locator('.subgroup-row', { hasText: 'Startup Page' });
    const activeStartupCard = startupSection.locator('.option-card.active');
    await expect(activeStartupCard).toBeVisible({ timeout: 5000 });
    const startupLabel = await activeStartupCard.locator('.option-card-label').textContent();
    originalStartupPage = startupLabel?.trim() || '';

    // Navigate back to Appearance tab for the tests
    await clickSettingsTab(page, 'Appearance');
  });

  test.afterAll(async () => {
    // Restore theme and startup page to original values
    try {
      // Ensure we're on the settings page
      const settingsPage = page.locator('.settings-page');
      if (!(await settingsPage.isVisible({ timeout: 2000 }).catch(() => false))) {
        await navigateToSettings(page);
      }

      // Restore theme on Appearance tab
      await clickSettingsTab(page, 'Appearance');
      const themeSection = page.locator('.subgroup-row', { hasText: 'Theme' });
      const originalThemeCard = themeSection.locator('.option-card', { hasText: originalTheme });
      await originalThemeCard.click();
      await expect(originalThemeCard).toHaveClass(/active/, { timeout: 3000 });

      // Restore startup page on General tab
      if (originalStartupPage) {
        await clickSettingsTab(page, 'General');
        const startupSection = page.locator('.subgroup-row', { hasText: 'Startup Page' });
        const originalStartupCard = startupSection.locator('.option-card', {
          hasText: originalStartupPage,
        });
        await originalStartupCard.click();
        await expect(originalStartupCard).toHaveClass(/active/, { timeout: 3000 });
      }
    } catch {
      // Best-effort restoration — don't fail teardown
    }

    await app?.close();
  });

  test('appearance tab shows Sidebar Options, Theme, Thread Format', async () => {
    // Requirement 12.1: appearance tab displays all option groups
    const panelTitle = page.locator('h2.panel-title');
    await expect(panelTitle).toHaveText('Appearance');

    // Verify all subgroup labels are visible
    const sidebarOptions = page.locator('.subgroup-label', { hasText: 'Sidebar Options' });
    await expect(sidebarOptions).toBeVisible({ timeout: 5000 });

    const theme = page.locator('.subgroup-label', { hasText: 'Theme' });
    await expect(theme).toBeVisible({ timeout: 5000 });

    const threadFormat = page.locator('.subgroup-label', { hasText: 'Thread Format' });
    await expect(threadFormat).toBeVisible({ timeout: 5000 });
  });

  test('selecting theme immediately applies it', async () => {
    // Requirement 12.2: theme applies immediately without save
    const themeSection = page.locator('.subgroup-row', { hasText: 'Theme' });

    // Get current active theme
    const activeTheme = themeSection.locator('.option-card.active');
    const activeLabel = await activeTheme.locator('.option-card-label').textContent();

    // Click the other theme
    const targetTheme = activeLabel?.trim() === 'Light' ? 'Dark' : 'Light';
    const targetCard = themeSection.locator('.option-card', { hasText: targetTheme });
    await targetCard.click();

    // The clicked card should now be active
    await expect(targetCard).toHaveClass(/active/, { timeout: 3000 });

    // Theme is applied immediately — verify the html element has the theme class
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    if (targetTheme === 'Dark') {
      expect(htmlClass).toContain('dark');
    } else {
      expect(htmlClass).not.toContain('dark');
    }

    // Revert to original theme
    const revertCard = themeSection.locator('.option-card', { hasText: activeLabel?.trim() });
    await revertCard.click();
    await expect(revertCard).toHaveClass(/active/, { timeout: 3000 });
  });

  test('changing startup page reflects in UI', async () => {
    // Requirement 12.3: changing startup page updates the selection
    // Startup Page is on the General tab, navigate there via shared helper
    await clickSettingsTab(page, 'General');

    const startupSection = page.locator('.subgroup-row', { hasText: 'Startup Page' });
    const startupCards = startupSection.locator('.option-card');

    // Should have multiple startup page options
    const count = await startupCards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Get the currently active option
    const activeCard = startupSection.locator('.option-card.active');
    const activeLabel = await activeCard.locator('.option-card-label').textContent();

    // Click a different option (the second one if first is active, else first)
    const targetIndex =
      (await activeCard.evaluate((el) => {
        const parent = el.closest('.card-grid');
        const allCards = parent?.querySelectorAll('.option-card') || [];
        return Array.from(allCards).indexOf(el);
      })) === 0
        ? 1
        : 0;

    await startupCards.nth(targetIndex).click();

    // The clicked card should now be active
    await expect(startupCards.nth(targetIndex)).toHaveClass(/active/, { timeout: 3000 });

    // Revert to original
    const originalCard = startupSection.locator('.option-card', { hasText: activeLabel?.trim() });
    await originalCard.click();
    await expect(originalCard).toHaveClass(/active/, { timeout: 3000 });

    // Navigate back to Appearance tab for subsequent tests
    await clickSettingsTab(page, 'Appearance');
  });

  test('toggling sidebar options updates checkboxes', async () => {
    // Requirement 12.4: toggling sidebar options updates checkbox state
    const sidebarSection = page.locator('.subgroup-row', { hasText: 'Sidebar Options' });

    const recentCheckbox = sidebarSection.locator('input[type="checkbox"]').first();
    const favoritesCheckbox = sidebarSection.locator('input[type="checkbox"]').last();

    // Get initial states
    const recentInitial = await recentCheckbox.isChecked();
    const favoritesInitial = await favoritesCheckbox.isChecked();

    // Toggle recent list and verify state changed
    await recentCheckbox.click();
    await expect(recentCheckbox).toBeChecked({ checked: !recentInitial, timeout: 3000 });

    // Toggle back and verify restored
    await recentCheckbox.click();
    await expect(recentCheckbox).toBeChecked({ checked: recentInitial, timeout: 3000 });

    // Toggle favorites list and verify state changed
    await favoritesCheckbox.click();
    await expect(favoritesCheckbox).toBeChecked({ checked: !favoritesInitial, timeout: 3000 });

    // Toggle back and verify restored
    await favoritesCheckbox.click();
    await expect(favoritesCheckbox).toBeChecked({ checked: favoritesInitial, timeout: 3000 });
  });

  test('adjusting chat text size slider shows value', async () => {
    // Requirement 12.5: chat text size slider displays current font size
    const threadFormatSection = page.locator('.subgroup-row', { hasText: 'Thread Format' });

    // Find the control label that shows the font size value
    const sizeLabel = threadFormatSection.locator('.control-label', { hasText: 'Chat Text Size' });
    await expect(sizeLabel).toBeVisible({ timeout: 5000 });

    // Should show a value like "14pt"
    const labelText = await sizeLabel.textContent();
    expect(labelText).toMatch(/\d+pt/);

    // Find the range slider
    const slider = threadFormatSection.locator('input[type="range"]');
    await expect(slider).toBeVisible({ timeout: 3000 });

    // Get current value
    const currentValue = await slider.inputValue();
    expect(Number(currentValue)).toBeGreaterThan(0);
  });
});
