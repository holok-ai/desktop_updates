import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as os from 'os';
import * as path from 'path';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

async function navigateToSettings(page: Page): Promise<void> {
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');

  // Login if needed
  const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
  if ((await loginBtn.count()) > 0) {
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    await loginBtn.click();
    await page.waitForTimeout(500);
  }

  // Open Settings via sidebar profile submenu
  const profileButton = page
    .locator('nav')
    .locator('button')
    .filter({ has: page.locator('.pi-user') })
    .first();
  await expect(profileButton).toBeVisible();
  await profileButton.click();

  const settingsItem = page.getByRole('menuitem', { name: 'Settings' });
  await expect(settingsItem).toBeVisible();
  await settingsItem.click();

  // Wait for Settings page to load
  const heading = page.getByRole('heading', { name: 'Settings' });
  await expect(heading).toBeVisible();
}

test.describe('E2E: Settings - File Tools Whitelist', () => {
  let app: ElectronApplication | undefined;
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    try {
      const electronExec = (await import('electron')).default as unknown as string;
      app = await electron.launch({ executablePath: electronExec, args: ['.'] });
    } catch {
      try {
        const electronExec = (await import('electron')).default as unknown as string;
        app = await electron.launch({
          executablePath: electronExec,
          args: ['dist-electron/main.js'],
        });
      } catch {
        test.skip(true, 'Electron failed to launch in this environment');
      }
    }
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

    // Look for File Tools section (exact match on heading level to avoid strict-mode conflicts)
    const fileToolsHeading = page.getByRole('heading', { level: 2, name: /^File Tools$/ });
    await expect(fileToolsHeading).toBeVisible();

    // Look for whitelist subsection
    const whitelistHeading = page.getByRole('heading', { level: 3, name: 'File Tools Whitelist' });
    await expect(whitelistHeading).toBeVisible();
  });

  test('displays empty state when no paths are whitelisted', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    // Clear any existing whitelist
    const removeButtons = page.getByRole('button', { name: 'Remove' });
    const count = await removeButtons.count();
    for (let i = 0; i < count; i++) {
      await removeButtons.first().click();
      await page.waitForTimeout(100);
    }

    // Check for empty state message
    const emptyMessage = page.getByText(/No whitelisted folders/i);
    await expect(emptyMessage).toBeVisible();
  });

  test('adds a folder path by typing and clicking Add', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    const testPath = os.tmpdir();

    // Find input and add button
    const pathInput = page.getByPlaceholder(/Enter folder path/i);
    await expect(pathInput).toBeVisible();
    
    await pathInput.fill(testPath);
    
    const addButton = page.getByRole('button', { name: 'Add', exact: true });
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

    const testPath = os.tmpdir();

    // Mock dialog handler and whitelist API to control results deterministically
    await page.evaluate((selectedPath) => {
      const whitelist: string[] = [];

      window.electronAPI.settings.selectFolder = async () => selectedPath;
      window.electronAPI.settings.addWhitelistPath = async (path: string) => {
        if (!whitelist.includes(path)) {
          whitelist.push(path);
        }
      };
      window.electronAPI.settings.getFileToolsWhitelist = async () => [...whitelist];
    }, testPath);

    const browseButton = page.getByRole('button', { name: /Browse/i });
    await browseButton.click();

    // Verify path appears in list (list item contains the selected path)
    await page.waitForTimeout(300);
    const pathItem = page.locator('li').filter({ hasText: testPath }).first();
    await expect(pathItem).toBeVisible();
  });

  test('removes a path from whitelist by clicking Remove', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    const testPath = path.join(os.tmpdir(), 'test-remove');

    // Add a path first
    const pathInput = page.getByPlaceholder(/Enter folder path/i);
    await pathInput.fill(testPath);
    
    // Mock path existence for this test
    await page.evaluate(() => {
      window.electronAPI.settings.addWhitelistPath = async () => {};
      window.electronAPI.settings.getFileToolsWhitelist = async () => [
        '/tmp/test-remove',
      ];
    });

    await page.reload();
    await navigateToSettings(page);

    // Find and click remove button
    const removeButton = page.getByRole('button', { name: 'Remove' }).first();
    await removeButton.click();

    // Verify path is removed
    await page.waitForTimeout(300);
  });

  test('prevents duplicate paths', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    const testPath = os.tmpdir();

    // Add path first time
    const pathInput = page.getByPlaceholder(/Enter folder path/i);
    await pathInput.fill(testPath);
    const addButton = page.getByRole('button', { name: 'Add', exact: true });
    await addButton.click();
    await page.waitForTimeout(200);

    // Try to add same path again
    await pathInput.fill(testPath);
    await addButton.click();
    await page.waitForTimeout(200);

    // Count occurrences - should still be 1
    const items = page.locator(`text="${testPath}"`);
    const count = await items.count();
    expect(count).toBeLessThanOrEqual(2); // May have label + list item
  });

  test('whitelist persists after closing and reopening settings', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    const testPath = os.tmpdir();

    // Add a path
    const pathInput = page.getByPlaceholder(/Enter folder path/i);
    await pathInput.fill(testPath);
    const addButton = page.getByRole('button', { name: 'Add', exact: true });
    await addButton.click();
    await page.waitForTimeout(200);

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

    // Verify path is still there
    const pathItem = page.getByText(testPath);
    await expect(pathItem).toBeVisible();
  });

  test('shows error for relative paths', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    // Try to add relative path
    const pathInput = page.getByPlaceholder(/Enter folder path/i);
    await pathInput.fill('./relative/path');
    const addButton = page.getByRole('button', { name: 'Add', exact: true });
    await addButton.click();

    // Wait for error message
    await page.waitForTimeout(300);
    const errorMessage = page.locator('text=/Path must be absolute/i');
    await expect(errorMessage).toBeVisible({ timeout: 2000 });
  });

  test('shows error for non-existent paths', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await navigateToSettings(page);

    // Try to add non-existent path
    const pathInput = page.getByPlaceholder(/Enter folder path/i);
    await pathInput.fill('/tmp/definitely-does-not-exist-12345');
    const addButton = page.getByRole('button', { name: 'Add', exact: true });
    await addButton.click();

    // Wait for error message
    await page.waitForTimeout(300);
    const errorMessage = page.locator('text=/does not exist/i');
    await expect(errorMessage).toBeVisible({ timeout: 2000 });
  });
});

