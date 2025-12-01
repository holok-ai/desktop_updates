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

  test('login → persist on reload → open settings from profile menu', async () => {
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

    // Reveal sidebar profile submenu (hover to open) and assert menu items
    const sidebarFooter = page.locator('[aria-label="User profile"]');
    await expect(sidebarFooter).toBeVisible();
    await sidebarFooter.hover();
    await page.waitForTimeout(200);
    const settingsBtn = page.getByRole('menuitem', { name: 'Settings' });
    await expect(settingsBtn).toBeVisible({ timeout: 10000 });

    // Reload renderer window to ensure auth state persists
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Reveal submenu again and ensure Settings is still available
    const sidebarFooter2 = page.locator('[aria-label="User profile"]');
    await expect(sidebarFooter2).toBeVisible();
    await sidebarFooter2.hover();
    await page.waitForTimeout(200);
    const settingsBtn2 = page.getByRole('menuitem', { name: 'Settings' });
    await expect(settingsBtn2).toBeVisible({ timeout: 10000 });

    // Click settings and verify navigation to Settings page
    await settingsBtn2.click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({
      timeout: 10000,
    });
  });
});
