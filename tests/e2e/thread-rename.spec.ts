import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

async function loginIfNeeded(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
  if ((await loginBtn.count()) > 0) {
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    await loginBtn.click();
    await page.waitForTimeout(1200);
  }
}

async function navigateToHome(page: Page): Promise<void> {
  // Ensure we're on the Home view so the sidebar thread list is visible
  const home = page.getByRole('menuitem', { name: 'Threads' });
  if ((await home.count()) > 0) {
    await home.click();
    await page.waitForTimeout(300);
  }
}

test.describe('E2E: Thread Rename (simple)', () => {
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

  test('rename first thread from sidebar context menu', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await loginIfNeeded(page);
    await navigateToHome(page);

    // Find first thread item with more actions button
    const firstThread = page
      .locator('li[role="menuitem"]')
      .filter({ has: page.locator('button[title="More"]') })
      .first();
    await expect(firstThread).toBeVisible({ timeout: 5000 });

    // Open context menu
    const moreButton = firstThread.locator('button[title="More"]');
    await moreButton.click();

    // Click Rename option
    const renameButton = page.getByRole('button', { name: /Rename/i });
    await expect(renameButton).toBeVisible({ timeout: 2000 });
    await renameButton.click();

    // Wait for rename editor to appear
    await expect(page.getByTestId('thread-title-editor')).toBeVisible({ timeout: 2000 });

    // Enter new title
    const titleInput = page.getByTestId('title-input');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Renamed Thread E2E - simple');

    // Save the rename
    const saveButton = page.getByTestId('save-button');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for editor to detach
    await page.getByTestId('thread-title-editor').waitFor({ state: 'detached', timeout: 5000 });

    // Verify title updated in sidebar
    await expect(
      page.locator('li[role="menuitem"]').filter({ hasText: 'Renamed Thread E2E - simple' }),
    ).toBeVisible({ timeout: 4000 });
  });
});
