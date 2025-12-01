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

async function createNewThread(page: Page, initialPrompt: string): Promise<void> {
  await navigateToThreads(page);
  await page.waitForTimeout(500);

  // The simplified thread creation form should be visible (model chooser + prompt input)
  // Model is pre-selected by default
  const modelSelect = page.locator('select#model-select');
  await expect(modelSelect).toBeVisible({ timeout: 3000 });

  // Fill the prompt and send (this creates the thread)
  const promptTextarea = page.locator('textarea#thread-prompt');
  await expect(promptTextarea).toBeVisible({ timeout: 3000 });
  await promptTextarea.fill(initialPrompt);

  // Submit by pressing Enter or clicking Send
  const sendButton = page.getByRole('button', { name: /Send/ });
  await expect(sendButton).toBeEnabled({ timeout: 2000 });
  await sendButton.click();

  // Wait for thread to be created and chat view to appear
  await expect(page.locator('.chat-pane')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(500);
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

  test('should auto-generate title from initial prompt', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await mockLogin(page);

    // Create thread with initial prompt - title auto-generated from prompt
    const prompt = 'Test prompt. Reply shortly';
    await createNewThread(page, prompt);

    // Wait for user message to appear
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: prompt }),
    ).toBeVisible({ timeout: 5000 });

    // Wait for assistant response
    await expect(page.locator('.messages .message.assistant')).toBeVisible({ timeout: 30000 });

    // Wait for title generation
    await page.waitForTimeout(2000);

    // Verify title in chat header - should contain text from prompt
    const chatHeader = page.locator('.chat-header h2');
    await expect(chatHeader).toBeVisible({ timeout: 5000 });
    const titleText = await chatHeader.textContent();

    expect(titleText).toBeTruthy();
    expect(titleText).not.toBe('New Thread');
    expect(titleText?.trim().length).toBeGreaterThan(5);

    console.log('✓ Generated title in chat header:', titleText);
  });
});
