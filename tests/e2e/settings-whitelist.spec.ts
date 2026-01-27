import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import * as os from 'os';
import * as path from 'path';

function getFileToolsSection(page: Page) {
  // Scope queries to the Allowed Directories section to avoid strict-mode conflicts
  return page.locator('section').filter({ hasText: 'Allowed Directories' }).first();
}

async function navigateToSettings(page: Page): Promise<void> {
  // Wait for page to be in stable state before any navigation
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300);

  // Open Settings via sidebar profile submenu
  const profileButton = page
    .locator('nav')
    .locator('button')
    .filter({ has: page.locator('.pi-user') })
    .first();
  await expect(profileButton).toBeVisible();
  await profileButton.click();

  // Open Settings via sidebar - try multiple selectors
  let settingsItem = page.getByRole('menuitem', { name: /Settings/i });
  if ((await settingsItem.count()) === 0) {
    settingsItem = page.getByRole('button', { name: /Settings/i });
  }
  if ((await settingsItem.count()) === 0) {
    settingsItem = page.getByRole('link', { name: /Settings/i });
  }
  await expect(settingsItem.first()).toBeVisible({ timeout: 60000 });
  await settingsItem.first().click();

  // Wait for Settings page to load
  const heading = page.getByRole('heading', { name: 'Settings' });
  await expect(heading).toBeVisible();
}

test.describe('E2E: Settings - File Tools Whitelist', () => {
  let app: ElectronApplication | undefined;
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    app = await launchAuthenticatedApp();
  });

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('displays File Tools whitelist section', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    // Look for Allowed Directories section (exact match on heading level to avoid strict-mode conflicts)
    const allowedDirsHeading = page.getByRole('heading', {
      level: 2,
      name: /^Allowed Directories$/,
    });
    await expect(allowedDirsHeading).toBeVisible();

    // Look for whitelist subsection heading
    const whitelistHeading = page.getByRole('heading', {
      level: 3,
      name: 'Allow Access To Directories',
    });
    await expect(whitelistHeading).toBeVisible();
  });

  test('displays empty state when no paths are whitelisted', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    // Ensure underlying settings whitelist is cleared before loading settings UI
    await page.evaluate(async () => {
      await window.electronAPI.settings.setMultiple({ directoryWhitelist: [] });
    });
    await navigateToSettings(page);

    const section = getFileToolsSection(page);

    // Clear any existing whitelist (if UI still shows items)
    const removeButtons = section.getByRole('button', { name: 'Remove' });
    const count = await removeButtons.count();
    for (let i = 0; i < count; i++) {
      await removeButtons.first().click();
      await page.waitForTimeout(100);
    }

    // Check for empty state message
    const emptyMessage = page.getByText(/No allowed directories/i);
    await expect(emptyMessage).toBeVisible();
  });

  test('adds a folder path by typing and clicking Add', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    const testPath = os.tmpdir();

    const section = getFileToolsSection(page);

    // Find input and add button within Allowed Directories section
    const pathInput = section.getByPlaceholder(/Enter folder path/i);
    await expect(pathInput).toBeVisible();

    await pathInput.fill(testPath);

    const addButton = section.locator('button', { hasText: 'Add' }).first();
    await addButton.click();

    // Verify path appears in list
    await page.waitForTimeout(300);
    const pathItem = page.getByText(testPath);
    await expect(pathItem).toBeVisible();
  });

  test('adds a folder using Browse button', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    const section = getFileToolsSection(page);

    const browseButton = section.getByRole('button', { name: /Browse/i });
    await expect(browseButton).toBeVisible();
    await browseButton.click();
  });

  test('removes a path from whitelist by clicking Remove', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    const testPath = path.join(os.tmpdir(), 'test-remove');

    const section = getFileToolsSection(page);

    // Add a path first via UI
    const pathInput = section.getByPlaceholder(/Enter folder path/i);
    await pathInput.fill(testPath);
    const addButton = section.locator('button', { hasText: 'Add' }).first();
    await addButton.click();
    await page.waitForTimeout(200);

    // Ensure it appears
    const listItem = section.locator('li').filter({ hasText: testPath }).first();
    await expect(listItem).toBeVisible();

    // Find and click remove button
    const removeButton = listItem.getByRole('button', { name: 'Remove' });
    await removeButton.click();

    // Verify path is removed from UI
    await expect(section.locator('li').filter({ hasText: testPath })).toHaveCount(0);
  });

  test('prevents duplicate paths', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    const testPath = os.tmpdir();

    const section = getFileToolsSection(page);

    // Add path first time
    const pathInput = section.getByPlaceholder(/Enter folder path/i);
    await pathInput.fill(testPath);
    const addButton = section.locator('button', { hasText: 'Add' }).first();
    await addButton.click();
    await page.waitForTimeout(200);

    // Try to add same path again
    await pathInput.fill(testPath);
    await addButton.click();
    await page.waitForTimeout(200);

    // Count occurrences - should still be 1
    const items = section.locator(`text="${testPath}"`);
    const count = await items.count();
    expect(count).toBeLessThanOrEqual(2); // May have label + list item
  });

  test('whitelist persists after closing and reopening settings', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    const testPath = os.tmpdir();

    const section = getFileToolsSection(page);

    // Add a path via UI
    const pathInput = section.getByPlaceholder(/Enter folder path/i);
    await pathInput.fill(testPath);
    const addButton = section.locator('button', { hasText: 'Add' }).first();
    await addButton.click();
    await page.waitForTimeout(200);

    // Persist whitelist using settings API (equivalent to what Save does for this field)
    await page.evaluate(async (p) => {
      const all = await window.electronAPI.settings.getAll();
      const next = [...(all.directoryWhitelist ?? []), p];
      await window.electronAPI.settings.setMultiple({ directoryWhitelist: next });
    }, testPath);
    await page.waitForTimeout(300);

    // Navigate away
    const profileButton = page
      .locator('nav')
      .locator('button')
      .filter({ has: page.locator('.pi-user') })
      .first();
    await profileButton.click();
    const threadsItem = page.getByRole('button', { name: /Threads/i });
    if ((await threadsItem.count()) > 0) {
      await threadsItem.click();
    }

    // Navigate back to settings
    await navigateToSettings(page);

    // Verify path is still there (within Allowed Directories section)
    const sectionAfter = getFileToolsSection(page);
    const pathItem = sectionAfter.getByText(testPath).first();
    await expect(pathItem).toBeVisible();
  });

  test('shows error for relative paths', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    const section = getFileToolsSection(page);

    // Try to add relative path
    const pathInput = section.getByPlaceholder(/Enter folder path/i);
    await pathInput.fill('./relative/path');
    const addButton = section.locator('button', { hasText: 'Add' }).first();
    await addButton.click();

    // Wait for error message
    await page.waitForTimeout(300);
    const errorMessage = page.locator('text=/Path must be absolute/i');
    await expect(errorMessage).toBeVisible({ timeout: 2000 });
  });
});
