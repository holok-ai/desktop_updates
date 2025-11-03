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

    // Navigate to Threads
    await page.getByRole('button', { name: 'Threads' }).click();
    await expect(page.locator('.threads-list, .empty').first()).toBeVisible();

    // Create a thread if none exist
    const newBtn = page.getByRole('button', { name: 'New Thread' });
    if (await newBtn.count()) {
      await newBtn.click();
      await page.getByLabel('Title').fill('E2E Chat Thread');
      await page.getByLabel('Description').fill('testing chat');
      await page.getByRole('button', { name: 'Confirm Create', exact: true }).click();
    }

    // Select first thread card (wait for list to settle)
    const firstCard = page.locator('.thread-card').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });
    await firstCard.click();

    // Compose a prompt
    const prompt = 'Hello integration';
    const textarea = page.locator('textarea[placeholder="Write a message..."]');
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill(prompt);
    // Press Enter to send (mirrors normal UX), fallback to button click
    await textarea.press('Enter');
    // Wait briefly for message to render; if not sent, click Send
    try {
      await expect(
        page.locator('.messages .message.user .message-content', { hasText: prompt }),
      ).toBeVisible({ timeout: 5000 });
    } catch {
      await page.getByRole('button', { name: 'Send' }).click();
    }

    // Expect user message to appear
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }),
    ).toBeVisible();

    // Expect assistant response to appear (LLM may take longer to respond)
    await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
      timeout: 30000,
    });
  });
});
