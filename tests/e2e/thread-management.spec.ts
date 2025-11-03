import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test.describe('E2E: Thread management', () => {
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

  test('Create flow via dual sidebar', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Wait for full network idle to avoid racing on lazy-mounted login component
    await page.waitForLoadState('networkidle');

    // Login first if not already authenticated
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtn.count()) {
      // Ensure the login component is visible before interacting
      await expect(loginBtn).toBeVisible({ timeout: 5000 });
      await loginBtn.click();

      await page.waitForTimeout(1200);
    }

    // Navigate to Threads via main sidebar (menuitem)
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    // Ensure Threads page header visible
    await expect(page.getByRole('heading', { name: 'Threads', level: 1 })).toBeVisible();

    // Switch to Home activity to access quick actions, then open New Thread from secondary sidebar
    await page.getByRole('menuitem', { name: 'Home' }).click();
    const newThreadMenuItem = page.getByRole('menuitem', { name: 'New Thread' });
    await expect(newThreadMenuItem).toBeVisible();
    await newThreadMenuItem.click();
    await page.getByLabel('Title').fill('Playwright Thread');
    await page.getByLabel('Description').fill('Created by E2E');
    await page.getByRole('button', { name: 'Confirm Create', exact: true }).click();

    // Dialog should close after create; assert the confirm button disappears
    await expect(page.getByRole('button', { name: 'Confirm Create', exact: true })).toHaveCount(0);
  });
});
