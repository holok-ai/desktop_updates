import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

async function loginIfNeeded(page: Page): Promise<void> {
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

test.describe('E2E: Thread Rename', () => {
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
    if (app) {
      await app.close();
    }
  });

  test('Should rename thread from context menu', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await loginIfNeeded(page);
    await navigateToThreads(page);

    // Switch to Home to access thread list
    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.waitForTimeout(500);

    // Find a thread in the sidebar (look for any thread item with actions)
    const threadItems = page
      .locator('[role="menuitem"]')
      .filter({ hasText: /Recent:|Yesterday:|This Week:|Last 2 Weeks:|Older:/ })
      .first();

    // If no threads exist, create one first
    if ((await threadItems.count()) === 0) {
      await page.getByRole('menuitem', { name: 'New Thread' }).click();
      await page.getByLabel('Title').fill('Test Thread for Rename');
      await page.getByLabel('Description').fill('E2E test');
      await page.getByRole('button', { name: 'Confirm Create', exact: true }).click();
      await page.waitForTimeout(500);
    }

    // Find first thread item with more actions button
    const firstThread = page
      .locator('li[role="menuitem"]')
      .filter({ has: page.locator('button[title="More"]') })
      .first();
    await expect(firstThread).toBeVisible();

    // Get original title
    const originalTitle = await firstThread.textContent();

    // Open context menu
    const moreButton = firstThread.locator('button[title="More"]');
    await moreButton.click();

    // Click Rename option
    const renameButton = page.getByRole('button', { name: /Rename/i });
    await expect(renameButton).toBeVisible();
    await renameButton.click();

    // Wait for rename editor to appear
    await expect(page.getByTestId('thread-title-editor')).toBeVisible({ timeout: 2000 });

    // Enter new title
    const titleInput = page.getByTestId('title-input');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Renamed Thread E2E');

    // Save the rename
    const saveButton = page.getByTestId('save-button');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for editor to close
    await expect(page.getByTestId('thread-title-editor')).toHaveCount(0, { timeout: 2000 });

    // Verify title updated in sidebar
    await expect(
      page.locator('li[role="menuitem"]').filter({ hasText: 'Renamed Thread E2E' }),
    ).toBeVisible({ timeout: 2000 });
  });

  test('Should show validation error for empty title', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await loginIfNeeded(page);
    await navigateToThreads(page);
    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.waitForTimeout(500);

    // Find a thread and open rename
    const firstThread = page
      .locator('li[role="menuitem"]')
      .filter({ has: page.locator('button[title="More"]') })
      .first();
    await firstThread.locator('button[title="More"]').click();
    await page.getByRole('button', { name: /Rename/i }).click();

    await expect(page.getByTestId('thread-title-editor')).toBeVisible();

    // Clear title
    const titleInput = page.getByTestId('title-input');
    await titleInput.fill('');

    // Try to save
    const saveButton = page.getByTestId('save-button');
    await saveButton.click();

    // Should show error
    await expect(page.getByTestId('error-message')).toBeVisible();
    await expect(page.getByTestId('error-message')).toContainText(/empty/i);

    // Cancel
    await page.getByTestId('cancel-button').click();
    await expect(page.getByTestId('thread-title-editor')).toHaveCount(0);
  });

  test('Should show validation error for title over 200 characters', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await loginIfNeeded(page);
    await navigateToThreads(page);
    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.waitForTimeout(500);

    const firstThread = page
      .locator('li[role="menuitem"]')
      .filter({ has: page.locator('button[title="More"]') })
      .first();
    await firstThread.locator('button[title="More"]').click();
    await page.getByRole('button', { name: /Rename/i }).click();

    await expect(page.getByTestId('thread-title-editor')).toBeVisible();

    // Enter title over 200 chars
    const longTitle = 'A'.repeat(201);
    const titleInput = page.getByTestId('title-input');
    await titleInput.fill(longTitle);

    // Character counter should show error state
    const charCounter = page.getByTestId('char-counter');
    await expect(charCounter).toHaveClass(/error/);

    // Save button should be disabled
    const saveButton = page.getByTestId('save-button');
    await expect(saveButton).toBeDisabled();

    // Cancel
    await page.getByTestId('cancel-button').click();
  });

  test('Should cancel rename with Escape key', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await loginIfNeeded(page);
    await navigateToThreads(page);
    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.waitForTimeout(500);

    const firstThread = page
      .locator('li[role="menuitem"]')
      .filter({ has: page.locator('button[title="More"]') })
      .first();
    await firstThread.locator('button[title="More"]').click();
    await page.getByRole('button', { name: /Rename/i }).click();

    await expect(page.getByTestId('thread-title-editor')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Editor should close
    await expect(page.getByTestId('thread-title-editor')).toHaveCount(0, { timeout: 1000 });
  });

  test('Should save rename with Enter key', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await loginIfNeeded(page);
    await navigateToThreads(page);
    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.waitForTimeout(500);

    const firstThread = page
      .locator('li[role="menuitem"]')
      .filter({ has: page.locator('button[title="More"]') })
      .first();
    await firstThread.locator('button[title="More"]').click();
    await page.getByRole('button', { name: /Rename/i }).click();

    await expect(page.getByTestId('thread-title-editor')).toBeVisible();

    const titleInput = page.getByTestId('title-input');
    await titleInput.fill('Renamed with Enter');

    // Press Enter
    await page.keyboard.press('Enter');

    // Editor should close and title should be updated
    await expect(page.getByTestId('thread-title-editor')).toHaveCount(0, { timeout: 2000 });
    await expect(
      page.locator('li[role="menuitem"]').filter({ hasText: 'Renamed with Enter' }),
    ).toBeVisible({ timeout: 2000 });
  });

  test('Should show character counter', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await loginIfNeeded(page);
    await navigateToThreads(page);
    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.waitForTimeout(500);

    const firstThread = page
      .locator('li[role="menuitem"]')
      .filter({ has: page.locator('button[title="More"]') })
      .first();
    await firstThread.locator('button[title="More"]').click();
    await page.getByRole('button', { name: /Rename/i }).click();

    await expect(page.getByTestId('thread-title-editor')).toBeVisible();

    const titleInput = page.getByTestId('title-input');
    const charCounter = page.getByTestId('char-counter');

    // Type some text
    await titleInput.fill('Test Title');

    // Counter should update
    await expect(charCounter).toBeVisible();
    const counterText = await charCounter.textContent();
    expect(counterText).toMatch(/\d+ characters remaining/);

    // Cancel
    await page.getByTestId('cancel-button').click();
  });

  test('Should handle rename performance within 1 second', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await loginIfNeeded(page);
    await navigateToThreads(page);
    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.waitForTimeout(500);

    const firstThread = page
      .locator('li[role="menuitem"]')
      .filter({ has: page.locator('button[title="More"]') })
      .first();
    await firstThread.locator('button[title="More"]').click();
    await page.getByRole('button', { name: /Rename/i }).click();

    await expect(page.getByTestId('thread-title-editor')).toBeVisible();

    const titleInput = page.getByTestId('title-input');
    await titleInput.fill('Performance Test Title');

    // Measure rename operation time
    const startTime = Date.now();
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('thread-title-editor')).toHaveCount(0, { timeout: 2000 });
    const endTime = Date.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
  });

  test('Should maintain accessibility - ARIA labels', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await loginIfNeeded(page);
    await navigateToThreads(page);
    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.waitForTimeout(500);

    const firstThread = page
      .locator('li[role="menuitem"]')
      .filter({ has: page.locator('button[title="More"]') })
      .first();
    await firstThread.locator('button[title="More"]').click();
    await page.getByRole('button', { name: /Rename/i }).click();

    await expect(page.getByTestId('thread-title-editor')).toBeVisible();

    // Check dialog role
    const dialog = page.getByRole('dialog', { name: /Rename thread/i });
    await expect(dialog).toBeVisible();

    // Check input has proper aria-label
    const titleInput = page.getByTestId('title-input');
    const ariaLabel = await titleInput.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();

    // Check buttons have aria-labels
    const saveButton = page.getByTestId('save-button');
    const cancelButton = page.getByTestId('cancel-button');

    const saveAriaLabel = await saveButton.getAttribute('aria-label');
    const cancelAriaLabel = await cancelButton.getAttribute('aria-label');

    expect(saveAriaLabel).toContain('Save');
    expect(cancelAriaLabel).toContain('Cancel');

    await page.getByTestId('cancel-button').click();
  });

  test('Should allow keyboard navigation in editor', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    await loginIfNeeded(page);
    await navigateToThreads(page);
    await page.getByRole('menuitem', { name: 'Home' }).click();
    await page.waitForTimeout(500);

    const firstThread = page
      .locator('li[role="menuitem"]')
      .filter({ has: page.locator('button[title="More"]') })
      .first();
    await firstThread.locator('button[title="More"]').click();
    await page.getByRole('button', { name: /Rename/i }).click();

    await expect(page.getByTestId('thread-title-editor')).toBeVisible();

    // Input should be focused automatically
    const titleInput = page.getByTestId('title-input');
    await expect(titleInput).toBeFocused();

    // Tab should navigate to save button
    await page.keyboard.press('Tab');
    const saveButton = page.getByTestId('save-button');
    await expect(saveButton).toBeFocused();

    // Tab again should navigate to cancel button
    await page.keyboard.press('Tab');
    const cancelButton = page.getByTestId('cancel-button');
    await expect(cancelButton).toBeFocused();

    // Press Enter on cancel button
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('thread-title-editor')).toHaveCount(0);
  });
});
