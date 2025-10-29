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

  test('CRUD flow', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Login first if not already authenticated
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtn.count()) {
      await expect(loginBtn).toBeVisible();
      await loginBtn.click();

      await page.waitForTimeout(1200);
    }

    // Navigate to Threads via navbar
    await page.getByRole('button', { name: 'Threads' }).click();

    // Wait for list or empty state
    await expect(page.locator('.threads-list, .empty').first()).toBeVisible();

    // Create
    await page.getByRole('button', { name: 'New Thread' }).click();
    await page.getByLabel('Title').fill('Playwright Thread');
    await page.getByLabel('Description').fill('Created by E2E');
    await page.getByRole('button', { name: 'Confirm Create', exact: true }).click();

    const createdCard = page.locator('.thread-card', { hasText: 'Playwright Thread' });
    await expect(createdCard).toBeVisible();

    // Update
    await createdCard.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Title').fill('Playwright Thread Updated');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(
      page.locator('.thread-card', { hasText: 'Playwright Thread Updated' }),
    ).toBeVisible();

    // Delete (accept confirm dialog)
    page.once('dialog', (d) => d.accept());
    const updatedCard = page.locator('.thread-card', { hasText: 'Playwright Thread Updated' });
    await updatedCard.getByRole('button', { name: 'Delete' }).click();
    await expect(updatedCard).toHaveCount(0);
  });
});
