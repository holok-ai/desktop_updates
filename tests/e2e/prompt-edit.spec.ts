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
        app = await electron.launch({ executablePath: electronExec, args: ['dist-electron/main.js'] });
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

    // Create a new thread for this test
    await page.getByRole('menuitem', { name: 'Home' }).click();
    const newThreadMenuItem = page.getByRole('menuitem', { name: 'New Thread' });
    const threadName = 'Version History Test';
    if (await newThreadMenuItem.count()) {
      await newThreadMenuItem.click();
      await page.getByLabel('Title').fill(threadName);
      await page.getByLabel('Description').fill('testing version history');
      await page.getByRole('button', { name: 'Confirm Create', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Confirm Create', exact: true })).toHaveCount(0);
    }

    // Switch back to Threads and select the thread
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    const threadItem = page.getByRole('menuitem', { name: threadName }).first();
    await expect(threadItem).toBeVisible({ timeout: 5000 });
    await threadItem.click();

    // Send initial message
    const composer = page.locator('textarea[placeholder="Write a message..."]');
    await expect(composer).toBeVisible({ timeout: 5000 });
    await composer.fill('Just say "Okay"');
    await composer.press('Enter');

    // Wait for user and assistant messages
    await expect(page.locator('.messages .message.user', { hasText: 'Just say "Okay"' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.messages .message-content')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.messages .message.assistant.streaming')).toBeHidden({ timeout: 60000 });

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
    await expect(page.locator('.messages .message.assistant.streaming')).toBeHidden({ timeout: 60000 });

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


