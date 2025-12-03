import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test.describe('E2E: Model selection on thread start', () => {
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

  test('select model before creating thread and persist in metadata', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await page.waitForLoadState('networkidle');

    // Mock sign-in if needed
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtn.count()) {
      await expect(loginBtn).toBeVisible({ timeout: 5000 });
      await loginBtn.click();
      await page.waitForTimeout(1000);
    }

    // Navigate to Threads via sidebar item (role=menuitem)
    const threadsMenuItem = page.getByRole('menuitem', { name: 'Threads' });
    await expect(threadsMenuItem).toBeVisible();
    await threadsMenuItem.click();
    await page.waitForTimeout(500);

    // The simplified thread creation form should be visible
    // with model chooser and prompt input
    const select = page.locator('select#model-select');
    await expect(select).toBeVisible({ timeout: 3000 });

    // Choose a non-default model if available
    let selectedValue: string | null = null;
    const desired = 'openai::gpt-4o-mini';
    const desiredOption = select.locator(`option[value="${desired}"]`);
    if (await desiredOption.count()) {
      try {
        await select.selectOption(desired);
        selectedValue = desired;
      } catch {
        await select.evaluate((el, v) => {
          (el as any).value = v;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, desired);
        selectedValue = desired;
      }
    } else {
      // Get the current selection (default model)
      selectedValue = await select.inputValue();
      if (!selectedValue) {
        const options = select.locator('option');
        const optCount = await options.count();
        if (optCount > 0) {
          const val = await options.nth(0).getAttribute('value');
          if (val) {
            selectedValue = val;
          }
        }
      }
    }

    // Fill prompt and create thread (simplified flow)
    const promptText = 'E2E Model Selection Test - Just respond with OK';
    const promptTextarea = page.locator('textarea#thread-prompt');
    await expect(promptTextarea).toBeVisible({ timeout: 3000 });
    await promptTextarea.fill(promptText);

    // Send to create thread
    const sendButton = page.getByRole('button', { name: /Send/ });
    await expect(sendButton).toBeEnabled({ timeout: 2000 });
    await sendButton.click();

    // Wait for chat view to appear (thread created)
    await expect(page.locator('.chat-pane')).toBeVisible({ timeout: 5000 });

    // Wait for user message to appear
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: promptText }),
    ).toBeVisible({ timeout: 5000 });

    // Wait for response to start
    await expect(page.locator('.messages .message.assistant .message-content')).toBeVisible({
      timeout: 30000,
    });

    // Wait for streaming to complete
    try {
      await expect(page.locator('.messages .message.assistant.streaming')).toBeHidden({
        timeout: 60000,
      });
    } catch {
      const assistantMessages = page.locator('.messages .message.assistant .message-content');
      await expect(assistantMessages.first()).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(2000);
    }

    // Verify model persisted by checking thread metadata via IPC
    // Title is now auto-generated from prompt, so we search by prompt content
    const threadMetadata = await page.evaluate(async (prompt) => {
      const threads = await (window as any).electronAPI.thread.getAll();
      // Find thread that was just created (most recent with matching title pattern)
      const thread = threads.find((t: any) => t.title && t.title.includes('E2E Model Selection'));
      return thread?.metadata;
    }, promptText);

    expect(threadMetadata).toBeDefined();
    // Model should be stored in metadata
    if (selectedValue) {
      const [provider, modelId] = selectedValue.split('::');
      expect(threadMetadata.provider).toBe(provider);
      expect(threadMetadata.model).toBe(modelId);
    }
  });
});
