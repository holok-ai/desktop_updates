import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test.describe('E2E: Auth Flow (mock)', () => {
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

  // No beforeEach cleanup; test is resilient to persisted auth state

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('login → persist on reload → logout', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Wait for full network idle to avoid racing on lazy-mounted login component
    await page.waitForLoadState('networkidle');

    // If already authenticated, skip login; otherwise perform mock login
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtn.count()) {
      // Ensure the login component is visible before interacting
      await expect(loginBtn).toBeVisible({ timeout: 5000 });
      await loginBtn.click();
      // mockLogin waits ~1000ms; give it a moment to update UI
      await page.waitForTimeout(1200);
    }

    // Open sidebar profile submenu and assert Logout is available
    const profileBtn = page.locator('nav').locator('button').filter({ has: page.locator('.pi-user') }).first();
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();
    const logoutBtn = page.getByRole('button', { name: 'Logout' });
    await expect(logoutBtn).toBeVisible({ timeout: 10000 });

    // Reload renderer window to ensure auth state persists
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Open submenu again and ensure Logout is still available
    const profileBtn2 = page.locator('nav').locator('button').filter({ has: page.locator('.pi-user') }).first();
    await expect(profileBtn2).toBeVisible();
    await profileBtn2.click();
    const logoutBtn2 = page.getByRole('button', { name: 'Logout' });
    await expect(logoutBtn2).toBeVisible({ timeout: 10000 });

    // Logout and verify back to login screen
    await logoutBtn2.click();
    // After logout the page reloads; wait for login button again
    await expect(page.getByRole('button', { name: 'Sign In (Mock)' })).toBeVisible();
  });
});
