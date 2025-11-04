import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test.describe('E2E: Dual Sidebar', () => {
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

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('renders both sidebars and toggles collapse/expand', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await page.waitForLoadState('networkidle');

    // Login if needed
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtn.count()) {
      await expect(loginBtn).toBeVisible({ timeout: 5000 });
      await loginBtn.click();
      await page.waitForTimeout(1000);
    }

    // Expect both sidebars visible
    const mainSidebar = page.getByRole('navigation', { name: 'Main sidebar' });
    const activityListSidebar = page.getByRole('complementary', { name: 'Activity list sidebar' });
    await expect(mainSidebar).toBeVisible();
    await expect(activityListSidebar).toBeVisible();

    // Toggle main sidebar collapse/expand
    const mainToggle = page.getByRole('button', { name: 'Collapse/Expand Sidebar' });
    await expect(mainToggle).toBeVisible();
    await mainToggle.click();
    await page.waitForTimeout(200);
    await mainToggle.click();

    // Toggle activity list sidebar collapse/expand
    const activityToggle = page.getByRole('button', { name: 'Collapse/Expand Activity List' });
    await expect(activityToggle).toBeVisible();
    await activityToggle.click();
    await page.waitForTimeout(200);
    await activityToggle.click();
  });

  test('navigates via sidebars (Threads and New Thread)', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await page.waitForLoadState('networkidle');

    // Click Threads in main sidebar
    const threadsMenuItem = page.getByRole('menuitem', { name: 'Threads' });
    await expect(threadsMenuItem).toBeVisible();
    await threadsMenuItem.click();

    // Activity list should show grouped sections (at least one accordion by title or items list)
    const activityList = page.getByRole('complementary', { name: 'Activity list sidebar' });
    await expect(activityList).toBeVisible();

    // Navigate to Home then click New Thread quick action
    const homeMenuItem = page.getByRole('menuitem', { name: 'Home' });
    await homeMenuItem.click();

    // New Thread button rendered as a menuitem with label
    const newThreadItem = page.getByRole('menuitem', { name: 'New Thread' });
    await expect(newThreadItem).toBeVisible();
    await newThreadItem.click();

    // Threads page should handle ?create; rely on presence of create UI controls
    const confirmCreate = page.getByRole('button', { name: 'Confirm Create', exact: true });
    await expect(confirmCreate).toBeVisible();
  });
});


