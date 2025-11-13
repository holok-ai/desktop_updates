import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

async function mockLogin(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
  if ((await loginBtn.count()) > 0) {
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    await loginBtn.click();
    await page.waitForTimeout(1200);
  }
}

async function navigateToThreads(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'Threads' }).click();
  await expect(page.getByRole('heading', { name: 'Threads', level: 1 })).toBeVisible();
}

async function createNewThread(page: Page): Promise<void> {
  await navigateToThreads(page);
  await page.waitForTimeout(500);

  // Open create dialog
  const createBtn = page.getByRole('button', { name: 'Create Thread' });
  if ((await createBtn.count()) > 0) {
    await createBtn.click();
  } else {
    await page.evaluate(() => {
      const base = (window as any).location.hash.startsWith('#')
        ? (window as any).location.hash.split('?')[0]
        : '#/threads';
      (window as any).location.hash = base + '?create=';
    });
  }

  await expect(page.getByRole('heading', { name: /Create Thread|Edit Thread/ })).toBeVisible({
    timeout: 5000,
  });

  // Select model
  const modelSelect = page.locator('select#model-select');
  await expect(modelSelect).toBeVisible({ timeout: 3000 });
  const options = modelSelect.locator('option:not([value=""])');
  if ((await options.count()) > 0) {
    const val = await options.nth(0).getAttribute('value');
    if (val) await modelSelect.selectOption(val);
  }

  // Leave title empty for auto-generation
  const descInput = page.getByLabel('Description');
  if ((await descInput.count()) > 0) {
    await descInput.fill('E2E test thread for auto-title');
  }

  // Create thread
  const createButton = page.getByRole('button', { name: 'Confirm Create', exact: true });
  await expect(createButton).toBeVisible({ timeout: 2000 });
  await createButton.click();

  await expect(page.getByRole('heading', { name: /Create Thread/ })).toHaveCount(0, {
    timeout: 3000,
  });
  await page.waitForTimeout(800);
}

async function sendMessage(page: Page, message: string): Promise<void> {
  const textarea = page.locator('textarea[placeholder="Write a message..."]');
  await expect(textarea).toBeVisible({ timeout: 3000 });
  await textarea.fill(message);

  const sendButton = page.getByRole('button', { name: 'Send' });
  await expect(sendButton).toBeVisible({ timeout: 3000 });
  await sendButton.click();
}

test.describe('E2E: Thread Auto-Title Generation', () => {
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

  test('should auto-generate title after first assistant response', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await mockLogin(page);
    await createNewThread(page);

    const prompt = 'Test prompt. Reply shortly';
    await sendMessage(page, prompt);

    // Wait for user message to appear
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }),
    ).toBeVisible({ timeout: 5000 });

    // Wait for assistant response
    await expect(page.locator('.messages .message.assistant')).toBeVisible({ timeout: 30000 });

    // Wait for title generation
    await page.waitForTimeout(2000);

    // Verify title in chat header
    const chatHeader = page.locator('.chat-header h2');
    await expect(chatHeader).toBeVisible({ timeout: 5000 });
    const titleText = await chatHeader.textContent();

    expect(titleText).toBeTruthy();
    expect(titleText).not.toBe('New Thread');
    expect(titleText?.trim().length).toBeGreaterThan(5);

    console.log('✓ Generated title in chat header:', titleText);
  });
});
