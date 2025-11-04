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
    await page.waitForTimeout(500); // Wait for threads page to load

    // Open create dialog: use visible CTA if present, else force query param
    const createCta = page.getByRole('button', { name: 'Create Thread' });
    if (await createCta.count()) {
      await createCta.click();
    } else {
      // Trigger route query to open dialog
      await page.evaluate(() => {
        // eslint-disable-next-line no-restricted-globals
        const base = location.hash.startsWith('#') ? location.hash.split('?')[0] : '#/threads';
        // eslint-disable-next-line no-restricted-globals
        location.hash = base + '?create=';
      });
    }

    // Wait for dialog to appear
    await expect(page.getByRole('heading', { name: /Create Thread|Edit Thread/ })).toBeVisible();

    // Wait for model chooser select
    const select = page.locator('select#model-select');
    await expect(select).toBeVisible();

    // Choose a non-default model if available. Be robust: if the exact option
    // is not present, pick the first non-empty option value available. Record
    // the actual selected value so we can assert persistence matches it.
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
      const options = select.locator('option:not([value=""])');
      const optCount = await options.count();
      if (optCount > 0) {
        const val = await options.nth(0).getAttribute('value');
        if (val) {
          await select.selectOption(val);
          selectedValue = val;
        }
      } else {
        throw new Error('No model options available to select in ModelChooser');
      }
    }

    // Confirm create
    await page.getByLabel('Title').fill('E2E Model Thread');
    await page.getByLabel('Description').fill('Testing model selection persistence');
    await page.getByRole('button', { name: 'Confirm Create', exact: true }).click();

    // Wait for dialog to close
    await expect(page.getByRole('heading', { name: /Create Thread|Edit Thread/ })).not.toBeVisible({ timeout: 5000 });

    // Wait for thread to appear in sidebar (as a menuitem in the threads accordion)
    // The thread should appear in the ActivityListSidebar
    const threadItem = page.getByRole('menuitem', { name: 'E2E Model Thread' });
    await expect(threadItem).toBeVisible({ timeout: 10000 });

    // Verify model persisted by checking thread metadata via IPC
    const threadMetadata = await page.evaluate(async (title) => {
      const threads = await window.electronAPI.thread.getAll();
      const thread = threads.find((t: any) => t.title === title);
      return thread?.metadata;
    }, 'E2E Model Thread');

    expect(threadMetadata).toBeDefined();
    expect(selectedValue).not.toBeNull();
    // Metadata stores model ID separately from provider
    // Extract ID part from selectedValue (format: "provider::id" or just "id")
    const expectedModelId = selectedValue!.includes('::') ? selectedValue!.split('::')[1] : selectedValue!;
    expect(threadMetadata?.model).toBe(expectedModelId);
    expect(threadMetadata?.provider).toBeDefined();
  });
});
