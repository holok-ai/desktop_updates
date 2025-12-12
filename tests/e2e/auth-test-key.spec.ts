import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

let app: ElectronApplication;

// Helper to get first window
async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test.describe('Auth with Test Key', () => {
  test.beforeAll(async () => {
    // Hardcoded test tokens for development
    const testTokens = JSON.stringify({
      accessToken: 'eyJhbGciOiJIUzM4NCJ9.eyJ1c2VySWQiOiJwZXRlci5iYXh0ZXJAZHluYW1vLndvcmtzIiwib3JnYW5pemF0aW9uSWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJzdWIiOiIzYmY2NGUxOC03MzMzLTRjYjMtYWQzMy1iMDU1YjM2MzA4OGIiLCJpc3MiOiJtb2t1LWFwaSIsImlhdCI6MTc2NTQwMDg4MywiZXhwIjoyMDgwOTMzNjgzfQ.Kf5HkoEtr4DcjL5YqPWG0HcYmNYnxfgA0uIIfg3SAJWorJNekkysSoxfdf-PrcDz',
      user: {
        id: '3bf64e18-7333-4cb3-ad33-b055b363088b',
        email: 'peter.baxter@dynamo.works',
        name: 'Peter Baxter',
        organizationId: '00000000-0000-0000-0000-000000000001',
      },
      expiresAt: 2080933683000, // Expires in 2035
    });

    // Use hardcoded tokens or environment variable if provided
    const tokensToUse = process.env.PLAYWRIGHT_TEST_TOKENS || testTokens;

    try {
      const electronExec = (await import('electron')).default as unknown as string;
      app = await electron.launch({
        executablePath: electronExec,
        args: ['.'],
        env: {
          ...process.env,
          PLAYWRIGHT_TEST_TOKENS: tokensToUse,
        },
      });
    } catch {
      const electronExec = (await import('electron')).default as unknown as string;
      app = await electron.launch({
        executablePath: electronExec,
        args: ['dist-electron/main.js'],
        env: {
          ...process.env,
          PLAYWRIGHT_TEST_TOKENS: tokensToUse,
        },
      });
    }
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('should authenticate with test key and access home page', async () => {
    const page = await getFirstWindow(app);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if we're on login page or if we auto-redirected to home
    const currentUrl = page.url();
    console.log('[Test] Current URL:', currentUrl);

    if (currentUrl.includes('#/login')) {
      console.log('[Test] On login page - checking for Login With Key button');

      // If on login page, click "Login With Key" button
      const keyButton = page.getByRole('button', { name: 'Login With Key' });
      await expect(keyButton).toBeVisible({ timeout: 5000 });
      await keyButton.click();

      // Wait for navigation to home
      await page.waitForTimeout(1000);
    } else {
      console.log('[Test] Already authenticated - not on login page');
    }

    // Navigate to Threads page to trigger reactive re-evaluation of sidebar
    console.log('[Test] Navigating to Threads to verify sidebar items are visible');
    await page.evaluate(() => {
      window.location.hash = '#/threads';
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify we're authenticated by checking for navigation items
    // These should be visible in the sidebar now
    await expect(page.getByRole('menuitem', { name: 'Threads' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('menuitem', { name: 'Projects' })).toBeVisible({ timeout: 5000 });

    console.log('[Test] ✓ Successfully authenticated with test key');

    // Verify auth state via IPC
    const isAuth = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      return await api.auth.isAuthenticated();
    });

    expect(isAuth).toBe(true);
    console.log('[Test] ✓ isAuthenticated() returned true');

    // Verify auth state
    const authState = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      return await api.auth.getAuthState();
    });

    console.log('[Test] Auth state:', {
      isAuthenticated: authState.isAuthenticated,
      userName: authState.user?.name,
    });

    expect(authState.isAuthenticated).toBe(true);
    expect(authState.user?.name).toBe('Peter Baxter');
  });
});
