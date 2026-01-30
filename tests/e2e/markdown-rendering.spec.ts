import { test, expect, type ElectronApplication } from '@playwright/test';
import { launchAuthenticatedApp, getFirstWindow } from '../fixtures/electron-auth';
import {
  createThread,
  waitForMessageInput,
  navigateToHome,
  findModelByName,
} from '../helpers/ui-helpers';

test.describe('E2E: Markdown Rendering', () => {
  let app: ElectronApplication | undefined;
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    try {
      app = await launchAuthenticatedApp();
    } catch (error) {
      console.error('Failed to launch authenticated app:', error);
      test.skip(true, 'Electron failed to launch in this environment');
    }
  });

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('renders markdown with headers, bold, italic, and lists', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Already authenticated - no login needed!
    // Navigate to home first to load models
    await navigateToHome(page);

    // Dismiss any unsaved changes modal that might appear
    const unsavedModal = page.locator('text=Unsaved Changes');
    if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    }

    // Create thread using helper function (uses Haiku by default)
    await createThread(page, 'Test markdown rendering');

    // Wait for streaming to complete
    await waitForMessageInput(page);

    const markdown =
      '# Header 1\n\n**Bold text** and *italic text*\n\n- Item 1\n- Item 2\n- Item 3';

    await page.fill('[data-testid="message-input"]', markdown);
    await page.click('button.composer-send');

    // Wait for message to appear
    await page.waitForSelector('.message.user', { state: 'visible', timeout: 50000 });

    const message = page.locator('.message.user').last();

    // Verify markdown elements are rendered
    await expect(message.locator('h1')).toBeVisible();
    await expect(message.locator('strong')).toBeVisible();
    await expect(message.locator('em')).toBeVisible();
    await expect(message.locator('ul')).toBeVisible();
    const listItems = message.locator('ul li');
    await expect(listItems).toHaveCount(3);

    // CRITICAL: Wait for any assistant response streaming to complete before test ends
    // This prevents test 2 from getting stuck waiting for test 1's streaming
    const streamingMessage = page.locator('.message.assistant.streaming');
    const isStreaming = await streamingMessage.isVisible({ timeout: 2000 }).catch(() => false);
    if (isStreaming) {
      console.log('[Test 1] Waiting for assistant streaming to complete...');
      await expect(streamingMessage).toBeHidden({ timeout: 120000 });
      console.log('[Test 1] Streaming completed');
    }
  });

  test('renders inline code and code blocks with syntax highlighting', async () => {
    test.setTimeout(240000); // 4 minutes timeout
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Navigate to home to ensure clean state
    await navigateToHome(page);

    // Dismiss any unsaved changes modal that might appear
    const unsavedModal = page.locator('text=Unsaved Changes');
    if (await unsavedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    }

    // Already authenticated - no login needed!
    // Create thread using helper function (uses Haiku by default)
    await createThread(page, 'Test code blocks');

    // Wait for streaming to complete
    await waitForMessageInput(page);

    const content =
      'Inline code: `console.log()`\n\n```javascript\nconst x = 10;\nconsole.log(x);\n```';

    await page.fill('[data-testid="message-input"]', content);
    await page.click('button.composer-send');

    await page.waitForSelector('.message.user', { state: 'visible', timeout: 50000 });

    const message = page.locator('.message.user').last();

    // Verify inline code
    await expect(message.locator('.inline-code')).toBeVisible();

    // Verify code block with syntax highlighting
    await expect(message.locator('.code-block-wrapper')).toBeVisible();
    await expect(message.locator('.code-lang')).toContainText('javascript');
    await expect(message.locator('.hljs')).toBeVisible();

    // Verify copy button is present
    await expect(message.locator('.copy-btn')).toBeVisible();
  });
});
