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

  test('Create flow via dual sidebar', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Wait for full network idle to avoid racing on lazy-mounted login component
    await page.waitForLoadState('networkidle');

    // Login first if not already authenticated
    const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
    if (await loginBtn.count()) {
      // Ensure the login component is visible before interacting
      await expect(loginBtn).toBeVisible({ timeout: 5000 });
      await loginBtn.click();

      await page.waitForTimeout(1200);
    }

    // Navigate to Threads via main sidebar (menuitem)
    await page.getByRole('menuitem', { name: 'Threads' }).click();

    // Wait for the thread creation form to be visible
    await page.waitForTimeout(1000);

    // Wait for model selector to be visible
    const modelSelect = page.locator('select#model-select');
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

    // Fill in the prompt
    const promptTextarea = page.locator('textarea#thread-prompt');
    await expect(promptTextarea).toBeVisible({ timeout: 3000 });

    // Focus the textarea
    await promptTextarea.click();
    await page.waitForTimeout(200);

    // Clear any existing content
    await promptTextarea.clear();

    // Type the text (more reliable than fill for Svelte components)
    await promptTextarea.pressSequentially('Playwright Thread', { delay: 50 });

    // Wait a moment for the input to register
    await page.waitForTimeout(300);

    // Verify text was entered
    const textareaValue = await promptTextarea.inputValue();
    if (!textareaValue || textareaValue.trim() === '') {
      throw new Error('Failed to enter text in prompt textarea');
    }

    // Submit the form by pressing Enter
    await promptTextarea.press('Enter');

    // Wait for thread to be created
    await page.waitForTimeout(2000);
  });
});
