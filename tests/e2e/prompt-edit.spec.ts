import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

// E2E: Edit Prompt and Regenerate AI Response
// Preconditions: app starts with threads UI, chat provider mocked by existing test setup

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test.describe('Prompt Edit & Version History (E2E)', () => {
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

  test('user can open version history modal and see current and previous content', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Navigate to Threads to create a new thread
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.waitForTimeout(1000);

    // Wait for model selector to be visible
    const modelSelect = page.locator('select#model-select');
    await expect(modelSelect).toBeVisible({ timeout: 5000 });

    // Wait for models to load
    await page.waitForTimeout(1000);

    // Select the first model in the dropdown
    const options = await modelSelect.locator('option').count();
    if (options > 1) {
      await modelSelect.selectOption({ index: 1 });
    }

    await page.waitForTimeout(500);

    // Fill in the initial prompt to create the thread
    const promptTextarea = page.locator('textarea#thread-prompt');
    await expect(promptTextarea).toBeVisible({ timeout: 3000 });
    await promptTextarea.click();
    await promptTextarea.clear();
    await promptTextarea.pressSequentially('Just say "Okay"', { delay: 50 });
    await page.waitForTimeout(300);

    // Submit to create thread with first message
    await promptTextarea.press('Enter');
    await page.waitForTimeout(2000);

    // Wait for user and assistant messages
    await expect(
      page.locator('.messages .message.user', { hasText: 'Just say "Okay"' }),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.messages .message-content')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.messages .message.assistant.streaming')).toBeHidden({
      timeout: 60000,
    });

    // Enter inline edit and save
    await page.waitForTimeout(500);
    await page.locator('.message-actions button[title="Edit message"]').first().click();
    const inlineEditor = page.locator('textarea.edit-textarea').first();
    await inlineEditor.fill('Just say "Okay (edited)"');
    const saveBtn2 = page.locator('.edit-actions .save-button').first();
    await expect(saveBtn2).toBeEnabled({ timeout: 5000 });
    await saveBtn2.click();

    // Wait for regenerated response streaming to complete
    await page.waitForTimeout(500);
    await expect(page.locator('.messages .message.assistant.streaming')).toBeHidden({
      timeout: 60000,
    });

    // History button 📜 should be present after edit
    const historyBtn = page.locator('.message-actions button[title="View edit history"]').first();
    await expect(historyBtn).toBeVisible({ timeout: 5000 });
    await historyBtn.click();

    // Modal should open with headers
    const modal = page.locator('.modal-content');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Edit History')).toBeVisible();

    // Should show Current Version and at least one previous version
    await expect(modal.getByText('Current Version')).toBeVisible();
    await expect(modal.getByText('Just say "Okay"')).toBeVisible();

    // Close modal
    await page.locator('.close-button').click();
    await expect(modal).toBeHidden();
  });
});
