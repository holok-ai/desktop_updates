import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test.describe('E2E: Chat prompt/response', () => {
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
    if (app) await app.close();
  });

  test('send prompt and receive assistant response', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Wait for full network idle to avoid racing on lazy-mounted login component
    await page.waitForLoadState('networkidle');

    // Ensure we're authenticated (click mock sign-in if present)
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtn.count()) {
      // Ensure the login component is visible before interacting
      await expect(loginBtn).toBeVisible({ timeout: 5000 });
      await loginBtn.click();

      await page.waitForTimeout(1200);
    }

    // Navigate to Threads via main sidebar (menuitem)
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await expect(page.getByRole('heading', { name: 'Threads', level: 1 })).toBeVisible();

    // Ensure a thread exists by creating one via secondary sidebar quick action
    await page.getByRole('menuitem', { name: 'Home' }).click();
    const newThreadMenuItem = page.getByRole('menuitem', { name: 'New Thread' });
    let threadName = 'E2E Chat Thread';
    if (await newThreadMenuItem.count()) {
      await newThreadMenuItem.click();
      await page.getByLabel('Title').fill(threadName);
      await page.getByLabel('Description').fill('testing chat');
      await page.getByRole('button', { name: 'Confirm Create', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Confirm Create', exact: true })).toHaveCount(
        0,
      );
    }

    // Switch back to Threads activity and select the created thread from the grouped list
    await page.getByRole('menuitem', { name: 'Threads' }).click();

    // Thread might be in Recent section or other grouped sections
    // Use .first() to handle strict mode violation (duplicate items)
    const threadItem = page.getByRole('menuitem', { name: threadName }).first();
    if ((await threadItem.count()) === 0) {
      // Try to find by clicking through sections
      const sections = page
        .locator('[role="button"]')
        .filter({ hasText: /Recent|Yesterday|Last 7 Days/ });
      if ((await sections.count()) > 0) {
        await sections.first().click();
        await page.waitForTimeout(300);
      }
    }

    await expect(threadItem).toBeVisible({ timeout: 5000 });
    await threadItem.click();

    // Compose a prompt
    const prompt = 'Hello';
    const textarea = page.locator('textarea[placeholder="Write a message..."]');
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill(prompt);

    // Press Enter to send (mirrors normal UX)
    await textarea.press('Enter');

    // Wait for user message to appear in the UI
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }),
    ).toBeVisible({ timeout: 5000 });

    // Wait for assistant response to start streaming (message appears)
    await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
      timeout: 30000,
    });

    // Wait for streaming to complete by checking that the streaming indicator disappears
    // The .streaming class is removed when streaming completes
    await expect(page.locator('.messages .message.assistant.streaming')).toBeHidden({
      timeout: 60000,
    });
  });
});
