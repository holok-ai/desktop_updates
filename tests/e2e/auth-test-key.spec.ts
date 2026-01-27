import { test, expect, type ElectronApplication } from '@playwright/test';
import {
  launchAuthenticatedApp,
  getFirstWindow,
  verifyAuthenticated,
} from '../fixtures/electron-auth';

test.describe('Auth with Test Key', () => {
  let app: ElectronApplication | undefined;

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

  test('should authenticate with test tokens and access home page', async () => {
    if (!app) throw new Error('Electron not launched');
    const page = await getFirstWindow(app);

    // Already authenticated via PLAYWRIGHT_TEST_TOKENS - no login needed!
    // NOTE: If this test fails with timeout, check that TEST_TOKENS in
    // tests/fixtures/electron-auth.ts are valid for http://moku.holokai.dev
    console.log('[Test] App launched with test tokens');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check current URL
    const currentUrl = page.url();
    console.log('[Test] Current URL:', currentUrl);

    // Navigate to Threads page to verify sidebar items are visible
    console.log('[Test] Navigating to Threads to verify authentication');
    await page.evaluate(() => {
      window.location.hash = '#/threads';
    });

    // Wait for navigation with longer timeout (Windows can be slower)
    // Don't wait for networkidle as API calls might be pending/failing
    await page.waitForTimeout(20000);

    // Verify we're authenticated by checking for navigation items
    await expect(page.getByRole('menuitem', { name: 'Home' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('menuitem', { name: 'Threads' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('menuitem', { name: 'Projects' })).toBeVisible({ timeout: 5000 });

    console.log('[Test] ✓ Navigation items visible');

    // Verify auth state via helper
    const isAuth = await verifyAuthenticated(page);
    expect(isAuth).toBe(true);
    console.log('[Test] ✓ verifyAuthenticated() returned true');

    // Verify auth state details
    const authState = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      return await api.auth.getAuthState();
    });

    console.log('[Test] Auth state:', {
      isAuthenticated: authState.isAuthenticated,
      userName: authState.user?.name,
      userEmail: authState.user?.email,
    });

    expect(authState.isAuthenticated).toBe(true);
    expect(authState.user?.name).toBe('Kong Pham');
    expect(authState.user?.email).toBe('kong.pham@nkk.com.vn');

    console.log('[Test] ✓ Successfully authenticated with test tokens');
  });
});
