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

      // Wait for login to complete and models to load (post-auth callback)
      await page.waitForTimeout(3000);
    }

    // Navigate to Threads via main sidebar (menuitem)
    const threadsMenuItem = page.getByRole('menuitem', { name: 'Threads' });
    await expect(threadsMenuItem).toBeVisible({ timeout: 5000 });
    await threadsMenuItem.click();

    // Wait for Threads page to load - check for model selector (ThreadCreatePanel)
    // or chat interface, depending on whether threads exist
    await page.waitForTimeout(1000);

    // Wait for the thread creation form to be visible
    // If threads exist, we may need to trigger creation, otherwise it shows automatically
    await page.waitForTimeout(1000);

    // Check if model selector is visible (ThreadCreatePanel is shown)
    const modelSelect = page.locator('select#model-select');
    const isCreateFormVisible = await modelSelect.isVisible();

    if (!isCreateFormVisible) {
      // Need to click "New Thread" or similar button
      const newThreadButton = page.getByRole('button', { name: /new thread/i }).or(
        page.getByText(/new thread/i)
      );
      if (await newThreadButton.count()) {
        await newThreadButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Wait for model selector to be visible
    await expect(modelSelect).toBeVisible({ timeout: 5000 });

    // Wait for models to load
    await page.waitForTimeout(1000);

    // Select the first model in the dropdown (skip index 0 as it's usually empty/placeholder)
    const options = await modelSelect.locator('option').count();
    if (options > 1) {
      await modelSelect.selectOption({ index: 1 });
    } else {
      throw new Error('No models available in dropdown');
    }

    // Wait a bit for model selection to register
    await page.waitForTimeout(500);

    // Fill in the prompt - this will be the first message
    const promptTextarea = page.locator('textarea#thread-prompt');
    await expect(promptTextarea).toBeVisible({ timeout: 3000 });

    // Focus the textarea
    await promptTextarea.click();
    await page.waitForTimeout(200);

    // Clear any existing content
    await promptTextarea.clear();

    // Type the text (more reliable than fill for Svelte components)
    await promptTextarea.pressSequentially('Just say "Okay"', { delay: 50 });

    // Wait a moment for the input to register
    await page.waitForTimeout(300);

    // Verify text was entered
    const textareaValue = await promptTextarea.inputValue();
    if (!textareaValue || textareaValue.trim() === '') {
      throw new Error('Failed to enter text in prompt textarea');
    }

    // Submit the form by pressing Enter
    // This creates the thread AND sends the first message
    await promptTextarea.press('Enter');

    // Wait for thread to be created and first message to be sent
    await page.waitForTimeout(2000);

    // Wait for user message to appear in the UI
    await expect(
      page.locator('.messages .message.user .message-content', { hasText: 'Just say "Okay"' }),
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
