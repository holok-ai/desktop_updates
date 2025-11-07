import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test.describe('E2E: Settings', () => {
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

  test('navigates to Settings and toggles theme with persistence', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await page.waitForLoadState('networkidle');

    // Login if needed
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtn.count()) {
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

    const settingsItem = page.getByRole('button', { name: 'Settings' });
    await expect(settingsItem).toBeVisible();
    await settingsItem.click();

    // Expect Settings heading
    const heading = page.getByRole('heading', { name: 'Settings' });
    await expect(heading).toBeVisible();

    // Determine current theme and click opposite radio (Dark/Light)
    const isDarkBefore = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    const target = isDarkBefore ? 'light' : 'dark';
    await page.locator(`input[type="radio"][name="theme"][value="${target}"]`).check();

    // Theme should update immediately
    await page.waitForTimeout(100);
    const isDarkAfter = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(isDarkAfter).toBe(!isDarkBefore);

    // Reload and verify persistence via startup logic
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    const isDarkAfterReload = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(isDarkAfterReload).toBe(isDarkAfter);
  });
});
