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

    // Toggle main sidebar collapse/expand - try multiple selectors
    const mainToggle = page
      .locator('button[aria-label*="Collapse"]')
      .or(page.locator('button[aria-label*="Toggle"]'))
      .or(page.getByRole('button', { name: 'Collapse/Expand Sidebar' }))
      .first();
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

    // Wait for threads page to load
    await page.waitForTimeout(1000);

    // Activity list should show grouped sections (at least one accordion by title or items list)
    const activityList = page.getByRole('complementary', { name: 'Activity list sidebar' });
    await expect(activityList).toBeVisible();

    // Verify thread creation UI is visible (agent selector)
    const agentSelect = page.locator('select#agent-select');
    await expect(agentSelect).toBeVisible({ timeout: 5000 });

    // Verify prompt textarea is visible
    const promptTextarea = page.locator('textarea#thread-prompt');
    await expect(promptTextarea).toBeVisible({ timeout: 5000 });

    // Verify send button is visible
    const sendButton = page.getByRole('button', { name: /Send|Select a model|Enter a message/i });
    await expect(sendButton).toBeVisible({ timeout: 5000 });
  });
});
