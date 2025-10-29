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
        app = await electron.launch({ executablePath: electronExec, args: ['dist-electron/main.js'] });
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

    // If already authenticated, skip login; otherwise perform mock login
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtn.count()) {
      await expect(loginBtn).toBeVisible();
      await loginBtn.click();
      // mockLogin waits ~1000ms; give it a moment to update UI
      await page.waitForTimeout(1200);
    }

    // Expect App layout visible with Logout and header logo
    await page.getByRole('button', { name: 'Logout' }).waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.getByText('Holokai Desktop', { exact: true })).toBeVisible();

    // Reload renderer window to ensure auth state persists
    await page.reload();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    // Logout and verify back to login screen
    await page.getByRole('button', { name: 'Logout' }).click();
    // After logout the page reloads; wait for login button again
    await expect(page.getByRole('button', { name: 'Sign In (Mock)' })).toBeVisible();
  });
});
