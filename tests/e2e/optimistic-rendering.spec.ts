import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test.describe('Optimistic Message Rendering', () => {
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

  test('Message Send Failure (Edge Case)', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);
    // Force failure by exceeding in-memory repo size limit (> 8KB)
    const testMessage = 'X'.repeat(9000);
    await page.fill('[data-testid="message-input"]', testMessage);
    await page.click('[data-testid="send-button"]');
    
    // Verify message appears optimistically
    await page.waitForSelector(`text=${testMessage}`, { timeout: 100 });
    
    // Wait for failure status (after timeout)
    const failedIndicator = await page.waitForSelector('.status-failed', { timeout: 12000 });
    expect(failedIndicator).toBeTruthy();
    
    // Verify retry button is visible
    const retryButton = await page.locator('button:has-text("Retry")');
    await expect(retryButton).toBeVisible();
    
    // Click retry button
    await retryButton.click();
    
    // Verify message fails again (oversized) after retry
    await page.waitForSelector('.status-failed', { timeout: 12000 });
  });
});

