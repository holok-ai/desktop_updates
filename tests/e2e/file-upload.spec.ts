import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

async function ensureAuthenticated(page: Page): Promise<void> {
  const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
  if (await loginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginBtn.click();
    await page.waitForTimeout(1200);
  }
}

async function navigateToThreads(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'Threads' }).click();
  await expect(page.getByRole('heading', { name: 'Threads', level: 1 })).toBeVisible();
}

async function createTestThread(page: Page, initialPrompt: string): Promise<void> {
  // Navigate to threads to see the simplified create form
  await navigateToThreads(page);
  await page.waitForTimeout(300);

  // Model is pre-selected by default, just fill prompt and send
  const promptTextarea = page.locator('textarea#thread-prompt');
  await expect(promptTextarea).toBeVisible({ timeout: 3000 });
  await promptTextarea.fill(initialPrompt);

  // Submit to create thread
  const sendButton = page.getByRole('button', { name: /Send/ });
  await expect(sendButton).toBeEnabled({ timeout: 2000 });
  await sendButton.click();

  // Wait for thread to be created and chat view to appear
  await expect(page.locator('.chat-pane')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(500);
}

// Create test files
function createTestFile(filename: string, content: string): string {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function createTestImageFile(filename: string): string {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, filename);
  // Create a minimal valid PNG file (1x1 transparent pixel)
  const pngBuffer = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01, // 1x1 dimensions
    0x08,
    0x06,
    0x00,
    0x00,
    0x00,
    0x1f,
    0x15,
    0xc4,
    0x89,
    0x00,
    0x00,
    0x00,
    0x0a,
    0x49,
    0x44,
    0x41, // IDAT chunk
    0x54,
    0x78,
    0x9c,
    0x63,
    0x00,
    0x01,
    0x00,
    0x00,
    0x05,
    0x00,
    0x01,
    0x0d,
    0x0a,
    0x2d,
    0xb4,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e,
    0x44,
    0xae, // IEND chunk
    0x42,
    0x60,
    0x82,
  ]);
  fs.writeFileSync(filePath, pngBuffer);
  return filePath;
}

test.describe('E2E: File Upload Flow', () => {
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

  test('Scenario 1: Upload image file and send message', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await page.waitForLoadState('networkidle');
    await ensureAuthenticated(page);

    // Navigate to threads and create test thread
    await navigateToThreads(page);
    await createTestThread(page, 'File Upload Test Thread');

    // Navigate to the thread
    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.getByText('File Upload Test Thread').first().click();
    await page.waitForTimeout(500);

    // Create test image file
    const testImagePath = createTestImageFile('test-image.png');

    // Set up file chooser handler
    const fileChooserPromise = page.waitForEvent('filechooser');

    // Click the attach button (paperclip icon)
    const attachButton = page
      .locator('button[aria-label*="Attach"], button[title*="attach"]')
      .first();
    await attachButton.click();

    // Select file
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testImagePath);

    // Wait for preview to appear
    await expect(
      page.locator('[data-testid="attachment-preview"], .attachment-preview').first(),
    ).toBeVisible({
      timeout: 3000,
    });

    // Verify filename is displayed
    await expect(page.getByText('test-image.png')).toBeVisible();

    // Type a message
    const textarea = page.locator('textarea, [contenteditable="true"]').first();
    await textarea.fill('Here is an image attachment');

    // Send message
    const sendButton = page.getByRole('button', { name: /send|submit/i });
    await sendButton.click();

    // Wait for message to appear in history
    await page.waitForTimeout(1000);

    // Verify message with attachment appears
    await expect(page.getByText('Here is an image attachment')).toBeVisible();
    await expect(page.getByText('test-image.png')).toBeVisible();

    // Cleanup
    fs.unlinkSync(testImagePath);
  });

  test('Scenario 2: Upload multiple files', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Create test files
    const testFile1 = createTestFile('document1.txt', 'Test document content 1');
    const testFile2 = createTestFile('document2.txt', 'Test document content 2');

    // Navigate to threads
    await navigateToThreads(page);
    await createTestThread(page, 'Multi-File Upload Test');

    await page.getByRole('menuitem', { name: 'Threads' }).click();
    await page.getByText('Multi-File Upload Test').first().click();
    await page.waitForTimeout(500);

    // Set up file chooser for multiple files
    const fileChooserPromise = page.waitForEvent('filechooser');
    const attachButton = page
      .locator('button[aria-label*="Attach"], button[title*="attach"]')
      .first();
    await attachButton.click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([testFile1, testFile2]);

    // Wait for previews
    await page.waitForTimeout(500);

    // Verify both files appear in preview
    await expect(page.getByText('document1.txt')).toBeVisible();
    await expect(page.getByText('document2.txt')).toBeVisible();

    // Remove one file (if remove button exists)
    const removeButtons = page.locator('button[aria-label*="Remove"], button[title*="remove"]');
    if ((await removeButtons.count()) > 0) {
      await removeButtons.first().click();
      await page.waitForTimeout(200);
    }

    // Send message with remaining file(s)
    const textarea = page.locator('textarea, [contenteditable="true"]').first();
    await textarea.fill('Multiple files attached');
    const sendButton = page.getByRole('button', { name: /send|submit/i });
    await sendButton.click();

    await page.waitForTimeout(1000);

    // Cleanup
    fs.unlinkSync(testFile1);
    fs.unlinkSync(testFile2);
  });
});
