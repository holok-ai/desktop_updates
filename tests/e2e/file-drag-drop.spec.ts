import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
  fs.writeFileSync(filePath, pngBuffer);
  return filePath;
}

test.describe('E2E: File Drag and Drop', () => {
  let app: ElectronApplication | undefined;
  let page: Page;
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

    if (!app) return;
    page = await getFirstWindow(app);
    await ensureAuthenticated(page);
    await navigateToThreads(page);
    await createTestThread(page, 'Drag & Drop Test Thread');
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('should accept dropped files via file input and show previews', async () => {
    const testFilePath = createTestImageFile('drag-drop-test.png');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Check that preview appears
    await expect(page.locator('.attachments-preview')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=drag-drop-test.png')).toBeVisible();

    // Remove the attached file to clean up state for next test
    const removeButton = page.locator('.attachment-preview button[aria-label*="Remove"]').first();
    await removeButton.click();
    await expect(page.locator('.attachments-preview')).not.toBeVisible();

    // Clean up file
    fs.unlinkSync(testFilePath);
  });

  test('should handle multiple dropped files', async () => {
    const file1Path = createTestFile('test1.txt', 'Test file 1 content');
    const file2Path = createTestFile('test2.txt', 'Test file 2 content');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([file1Path, file2Path]);

    // Check that both previews appear
    await expect(page.locator('text=test1.txt')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=test2.txt')).toBeVisible({ timeout: 5000 });

    // Verify we have 2 attachment previews
    const attachmentPreviews = page.locator('.attachment-preview');
    await expect(attachmentPreviews).toHaveCount(2);

    // Remove all attached files to clean up state for next test
    const removeButton1 = page.locator('.attachment-preview button[aria-label*="Remove"]').first();
    await removeButton1.click();
    const removeButton2 = page.locator('.attachment-preview button[aria-label*="Remove"]').first();
    await removeButton2.click();
    await expect(page.locator('.attachments-preview')).not.toBeVisible();

    // Clean up files
    fs.unlinkSync(file1Path);
    fs.unlinkSync(file2Path);
  });

  test('should allow removing dropped files before sending', async () => {
    const testFilePath = createTestFile('test-remove.txt', 'Test content for removal');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Wait for preview
    await expect(page.locator('text=test-remove.txt')).toBeVisible({ timeout: 5000 });

    // Click remove button
    const removeButton = page.locator('.attachment-preview button[aria-label*="Remove"]').first();
    await removeButton.click();

    // Verify file is removed
    await expect(page.locator('text=test-remove.txt')).not.toBeVisible();
    await expect(page.locator('.attachments-preview')).not.toBeVisible();

    // Clean up
    fs.unlinkSync(testFilePath);
  });

  test('should clear dropped files after successful send', async () => {
    const testFilePath = createTestFile('test-send.txt', 'Test content for sending');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Wait for preview
    await expect(page.locator('text=test-send.txt')).toBeVisible({ timeout: 5000 });

    // Type a message
    const textarea = page.locator('textarea[placeholder="Write a message..."]');
    await textarea.fill('Message with attachment');

    // Send message
    const sendButton = page.locator('button:has-text("Send")');
    await sendButton.click();

    // Wait for message to be sent (composer should clear)
    await page.waitForTimeout(1000);
    await expect(textarea).toHaveValue('');

    // Verify attachments preview is cleared
    await expect(page.locator('.attachments-preview')).not.toBeVisible();

    // Clean up
    fs.unlinkSync(testFilePath);
  });

  test('should handle file removal with keyboard shortcuts', async () => {
    const testFilePath = createTestFile('test-keyboard.txt', 'Test keyboard interaction');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Wait for preview
    await expect(page.locator('text=test-keyboard.txt')).toBeVisible({ timeout: 5000 });

    // Focus on remove button and press Delete key
    const removeButton = page.locator('.attachment-preview button[aria-label*="Remove"]').first();
    await removeButton.focus();
    await page.keyboard.press('Delete');

    // Verify file is removed
    await expect(page.locator('text=test-keyboard.txt')).not.toBeVisible();
    await expect(page.locator('.attachments-preview')).not.toBeVisible();

    // Clean up file
    fs.unlinkSync(testFilePath);
  });
});
