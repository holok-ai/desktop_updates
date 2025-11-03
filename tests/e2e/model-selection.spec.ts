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

    // Navigate to Threads
    await page.getByRole('button', { name: 'Threads' }).click();
    await expect(page.locator('.threads-list, .empty').first()).toBeVisible();

    // Open create dialog
    await page.getByRole('button', { name: 'New Thread' }).click();

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
      // Try to select the desired option even if it's not fully visible in the
      // DOM (some renderings hide options). If selectOption throws, fall back
      // to setting the value via page script.
      try {
        await select.selectOption(desired);
        selectedValue = desired;
      } catch {
        // Fallback: set the select's value via JS and dispatch change
        await select.evaluate((el, v) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (el as any).value = v;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, desired);
        selectedValue = desired;
      }
    } else {
      // fallback: pick the first option with a non-empty value (skip the placeholder)
      const options = select.locator('option:not([value=""])');
      const optCount = await options.count();
      if (optCount > 0) {
        const val = await options.nth(0).getAttribute('value');
        if (val) {
          await select.selectOption(val);
          selectedValue = val;
        }
      } else {
        // no options to choose from - fail early with a helpful message
        throw new Error('No model options available to select in ModelChooser');
      }
    }

    // Confirm create
    await page.getByLabel('Title').fill('E2E Model Thread');
    await page.getByLabel('Description').fill('Testing model selection persistence');
    await page.getByRole('button', { name: 'Confirm Create', exact: true }).click();

    // Wait for created card
    const createdCard = page.locator('.thread-card', { hasText: 'E2E Model Thread' });
    await expect(createdCard).toBeVisible();

    // Open edit dialog and verify model persisted
    await createdCard.getByRole('button', { name: 'Edit' }).click();
    const editSelect = page.locator('select#model-select');
    await expect(editSelect).toBeVisible();
    const value = await editSelect.inputValue();
    // The persisted value should match whatever we actually selected (either the
    // desired option or the fallback). If selectedValue is null something went
    // wrong earlier and the test will fail here.
    expect(value).toBe(selectedValue);
  });
});
