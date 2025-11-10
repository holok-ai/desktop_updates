import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

async function ensureAuthenticated(page: Page): Promise<void> {
  const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
  if (await loginBtn.count()) {
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    await loginBtn.click();
    await page.waitForTimeout(1200);
  }
}

test.describe('E2E: Message State Flows (FSM)', () => {
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

  test('Scenario A: sending -> failed -> retrying -> sent (transient)', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await ensureAuthenticated(page);

    // Open Threads and create/select a thread
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.getByRole('menuitem', { name: 'New Thread' }).click();
    await page.getByLabel('Title').fill('E2E FSM Thread');
    await page.getByRole('button', { name: 'Confirm Create', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.getByRole('menuitem', { name: 'E2E FSM Thread' }).first().click();

    const textarea = page.locator('textarea[placeholder="Write a message..."]');
    await expect(textarea).toBeVisible({ timeout: 3000 });

    const prompt = 'E2E transient failure test';
    await textarea.fill(prompt);
    await textarea.press('Enter');

    // Wait for user message to appear and get client id
    const userMsg = page
      .locator('.messages .message.user .message-content', { hasText: prompt })
      .first();
    await expect(userMsg).toBeVisible({ timeout: 5000 });
    const wrapper = userMsg.locator('xpath=..');
    const clientId = await wrapper.getAttribute('data-client-id');
    const threadId = await wrapper.getAttribute('data-thread-id');
    expect(clientId).toBeTruthy();
    expect(threadId).toBeTruthy();

    // Simulate transient failure from server
    await page.evaluate(
      ({ clientId, threadId }) => {
        (window as any).messageStateMachine.handleEvent({
          type: 'FAIL',
          clientMessageId: clientId,
          threadId,
          errorCode: 503,
          errorMessage: 'Service Unavailable',
        });
      },
      { clientId, threadId },
    );

    // Expect failed icon
    await expect(wrapper.locator('.status-failed')).toBeVisible({ timeout: 2000 });

    // Wait for automatic retry (first backoff 3s) and expect retrying state
    await page.waitForTimeout(3500);
    await expect(wrapper.locator('.status-spinner')).toBeVisible({ timeout: 2000 });

    // Simulate ACK from server for retry
    await page.evaluate(
      ({ clientId, threadId }) => {
        (window as any).messageStateMachine.handleEvent({
          type: 'ACK',
          clientMessageId: clientId,
          threadId,
        });
      },
      { clientId, threadId },
    );

    // Expect sent icon
    await expect(wrapper.locator('.status-sent')).toBeVisible({ timeout: 2000 });
  });
});
