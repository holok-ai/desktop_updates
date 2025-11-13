import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

async function ensureAuthenticated(page: Page) {
  await page.waitForLoadState('networkidle');
  const loginBtn = page.getByRole('button', { name: 'Sign In (Mock)' });
  if (await loginBtn.count()) {
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    await loginBtn.click();
    await page.waitForTimeout(1500);
  }
}

async function waitForInputReady(page: Page) {
  const input = page.locator('[data-testid="message-input"]');

  // Wait for input to exist and be visible
  await expect(input).toBeVisible({ timeout: 10000 });

  // Wait for input to be enabled (not streaming)
  await page.waitForFunction(
    () => {
      const input = document.querySelector('[data-testid="message-input"]') as HTMLTextAreaElement;
      return input && !input.disabled;
    },
    { timeout: 15000 },
  );

  // Extra buffer for UI stability
  await page.waitForTimeout(500);
}

test.describe('E2E: Markdown Rendering', () => {
  let app: ElectronApplication | undefined;

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

  test('renders markdown with headers, bold, italic, and lists', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await ensureAuthenticated(page);
    await waitForInputReady(page);

    const markdown =
      '# Header 1\n\n**Bold text** and *italic text*\n\n- Item 1\n- Item 2\n- Item 3';

    await page.fill('[data-testid="message-input"]', markdown);
    await page.click('[data-testid="send-button"]');

    // Wait for message to appear
    await page.waitForSelector('.message.user', { state: 'visible', timeout: 5000 });

    const message = page.locator('.message.user').last();

    // Verify markdown elements are rendered
    await expect(message.locator('h1')).toBeVisible();
    await expect(message.locator('strong')).toBeVisible();
    await expect(message.locator('em')).toBeVisible();
    await expect(message.locator('ul')).toBeVisible();
    const listItems = message.locator('ul li');
    await expect(listItems).toHaveCount(3);
  });

  test('renders inline code and code blocks with syntax highlighting', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await ensureAuthenticated(page);
    await waitForInputReady(page);

    const content =
      'Inline code: `console.log()`\n\n```javascript\nconst x = 10;\nconsole.log(x);\n```';

    await page.fill('[data-testid="message-input"]', content);
    await page.click('[data-testid="send-button"]');

    await page.waitForSelector('.message.user', { state: 'visible', timeout: 5000 });

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

  test('auto-detects language and shows copy button feedback', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    await ensureAuthenticated(page);
    await waitForInputReady(page);

    // Code block without explicit language
    const code = '```\nfunction hello() {\n  return "world";\n}\n```';

    await page.fill('[data-testid="message-input"]', code);
    await page.click('[data-testid="send-button"]');

    await page.waitForSelector('.message.user', { state: 'visible', timeout: 5000 });

    const message = page.locator('.message.user').last();

    // Verify language was auto-detected
    const langBadge = message.locator('.code-lang.inferred');
    await expect(langBadge).toBeVisible();
    await expect(langBadge).toContainText('(auto)');

    // Test copy button
    const copyBtn = message.locator('.copy-btn');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Verify feedback
    await expect(message.locator('.copy-text')).toContainText('Copied!', { timeout: 2000 });
  });
});
