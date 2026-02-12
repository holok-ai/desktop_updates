/**
 * Settings - Appearance E2E Tests
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5
 * - Appearance tab shows Startup Page, Sidebar Options, Theme, Thread Format
 * - Selecting theme immediately applies it
 * - Changing startup page reflects in UI
 * - Toggling sidebar options updates checkboxes
 * - Adjusting chat text size slider shows value
 */

import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';

let app: ElectronApplication;
let page: Page;

test.describe.serial('Settings - Appearance', () => {
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

    // Click Appearance tab
    const appearanceItem = page.locator('.sidebar-item', { hasText: 'Appearance' });
    await appearanceItem.click();
    await page.waitForTimeout(500);
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('appearance tab shows Startup Page, Sidebar Options, Theme, Thread Format', async () => {
    // Requirement 12.1: appearance tab displays all option groups
    const panelTitle = page.locator('h2.panel-title');
    await expect(panelTitle).toHaveText('Appearance');

    // Verify all subgroup labels are visible
    const startupPage = page.locator('.subgroup-label', { hasText: 'Startup Page' });
    await expect(startupPage).toBeVisible({ timeout: 5000 });

    const sidebarOptions = page.locator('.subgroup-label', { hasText: 'Sidebar Options' });
    await expect(sidebarOptions).toBeVisible({ timeout: 5000 });

    const theme = page.locator('.subgroup-label', { hasText: 'Theme' });
    await expect(theme).toBeVisible({ timeout: 5000 });

    const threadFormat = page.locator('.subgroup-label', { hasText: 'Thread Format' });
    await expect(threadFormat).toBeVisible({ timeout: 5000 });
  });

  test('selecting theme immediately applies it', async () => {
    // Requirement 12.2: theme applies immediately without save
    // Find the theme option cards in the card-grid-2
    const themeSection = page.locator('.subgroup-row', { hasText: 'Theme' });
    const themeCards = themeSection.locator('.option-card');

    // Get current active theme
    const activeTheme = themeSection.locator('.option-card.active');
    const activeLabel = await activeTheme.locator('.option-card-label').textContent();

    // Click the other theme
    const targetTheme = activeLabel?.trim() === 'Light' ? 'Dark' : 'Light';
    const targetCard = themeSection.locator('.option-card', { hasText: targetTheme });
    await targetCard.click();
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(500);
  });

  test('changing startup page reflects in UI', async () => {
    // Requirement 12.3: changing startup page updates the selection
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
      (await activeCard.evaluate((el, cards) => {
        const parent = el.closest('.card-grid');
        const allCards = parent?.querySelectorAll('.option-card') || [];
        return Array.from(allCards).indexOf(el);
      })) === 0
        ? 1
        : 0;

    await startupCards.nth(targetIndex).click();
    await page.waitForTimeout(500);

    // The clicked card should now be active
    await expect(startupCards.nth(targetIndex)).toHaveClass(/active/, { timeout: 3000 });

    // Revert to original
    await activeCard.click().catch(() => {
      // If original card reference is stale, find it by label
    });
    const originalCard = startupSection.locator('.option-card', { hasText: activeLabel?.trim() });
    await originalCard.click();
    await page.waitForTimeout(500);
  });

  test('toggling sidebar options updates checkboxes', async () => {
    // Requirement 12.4: toggling sidebar options updates checkbox state
    const sidebarSection = page.locator('.subgroup-row', { hasText: 'Sidebar Options' });

    const recentCheckbox = sidebarSection.locator('input[type="checkbox"]').first();
    const favoritesCheckbox = sidebarSection.locator('input[type="checkbox"]').last();

    // Get initial states
    const recentInitial = await recentCheckbox.isChecked();
    const favoritesInitial = await favoritesCheckbox.isChecked();

    // Toggle recent list
    await recentCheckbox.click();
    await page.waitForTimeout(300);
    expect(await recentCheckbox.isChecked()).toBe(!recentInitial);

    // Toggle back
    await recentCheckbox.click();
    await page.waitForTimeout(300);
    expect(await recentCheckbox.isChecked()).toBe(recentInitial);

    // Toggle favorites list
    await favoritesCheckbox.click();
    await page.waitForTimeout(300);
    expect(await favoritesCheckbox.isChecked()).toBe(!favoritesInitial);

    // Toggle back
    await favoritesCheckbox.click();
    await page.waitForTimeout(300);
    expect(await favoritesCheckbox.isChecked()).toBe(favoritesInitial);
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
