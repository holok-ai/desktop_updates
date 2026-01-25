/**
 * Electron Authentication Fixture for E2E Tests
 *
 * Provides centralized authentication using PLAYWRIGHT_TEST_TOKENS environment variable.
 * This approach eliminates the need for UI-based login interactions in tests.
 *
 * @see tests/e2e/README-auth-test-key.md for detailed documentation
 */

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

/**
 * Test credentials valid until 2036
 * These tokens are hardcoded for convenience in test environments only.
 *
 * Security Note:
 * - Only work in test environment
 * - Do not overwrite real user credentials
 * - Exist in-memory only when PLAYWRIGHT_TEST_TOKENS is set
 * - Real tokens remain in encrypted storage untouched
 */
export const TEST_TOKENS = {
  accessToken:
    'eyJhbGciOiJIUzM4NCJ9.eyJ1c2VySWQiOiJrb25nLnBoYW1AbmtrLmNvbS52biIsIm9yZ2FuaXphdGlvbklkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAxIiwiYXBwU2x1Z3MiOlsiMDRkZGJjNjMiLCIyMGE1NzhkYSIsIjMwMTViY2ZmIiwiNDc4ZjJjYTciLCI4ZGI5ZDkwOCIsImEyMzY1ZTdlIiwiYThmMGVkZmIiLCJkNmQyMTBmMSIsImRjNzQzZTg0IiwiZTNiN2Q5OWIiXSwic3ViIjoiMTk0NTFmNzUtZDlmNi00ZGEyLWIxN2ItYWYzYjY0OWU2ZmU4IiwiaXNzIjoibW9rdS1hcGkiLCJpYXQiOjE3NjkzNDgzMzcsImV4cCI6MTc2OTQzNDczN30.BrTOuoXYM69qzTXSQUh84uwXIAOiqfoXaCs-HWDR2YE_IFrPxVOeQAeayinGUAXu',
  apiKey:
    'eyJhbGciOiJIUzM4NCJ9.eyJ1c2VySWQiOiJrb25nLnBoYW1AbmtrLmNvbS52biIsIm9yZ2FuaXphdGlvbklkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAxIiwic3ViIjoiMTk0NTFmNzUtZDlmNi00ZGEyLWIxN2ItYWYzYjY0OWU2ZmU4IiwiaXNzIjoibW9rdS1hcGkiLCJpYXQiOjE3NjkyNDM1NjcsImV4cCI6MjA4NDc3NjM2N30.ZhksfPL5K59H96ZVYmUwKyOb9abvVwh6V9XXv1uijRiMPVGs3pktfdO_yzESDXtO',
  user: {
    id: '19451f75-d9f6-4da2-b17b-af3b649e6fe8',
    email: 'kong.pham@nkk.com.vn',
    name: 'Kong Pham',
    organizationId: '00000000-0000-0000-0000-000000000001',
  },
  expiresAt: 2084776367000, // Expires in 2036
};

/**
 * Launch Electron app with pre-authenticated test user
 *
 * Authentication happens automatically at app startup via AuthService.loadTestTokens()
 * No UI interaction required - the app launches already authenticated.
 *
 * @returns ElectronApplication instance with authenticated user
 *
 * @example
 * ```typescript
 * test.beforeAll(async () => {
 *   app = await launchAuthenticatedApp();
 * });
 *
 * test('my test', async () => {
 *   const page = await getFirstWindow(app);
 *   // Already authenticated - no login needed!
 * });
 * ```
 */
export async function launchAuthenticatedApp(): Promise<ElectronApplication> {
  const testTokensJson = JSON.stringify(TEST_TOKENS);

  try {
    // Try launching from source (development)
    const electronExec = (await import('electron')).default as unknown as string;
    return await electron.launch({
      executablePath: electronExec,
      args: ['.'],
      env: {
        ...process.env,
        PLAYWRIGHT_TEST_TOKENS: testTokensJson,
      },
    });
  } catch {
    // Fallback to built version (production)
    const electronExec = (await import('electron')).default as unknown as string;
    return await electron.launch({
      executablePath: electronExec,
      args: ['dist-electron/main.js'],
      env: {
        ...process.env,
        PLAYWRIGHT_TEST_TOKENS: testTokensJson,
      },
    });
  }
}

/**
 * Get the first window from the Electron app
 *
 * @param app - ElectronApplication instance
 * @returns Page object for the first window
 */
export async function getFirstWindow(app: ElectronApplication): Promise<Page> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/**
 * Verify that the app is authenticated
 *
 * Useful for debugging or asserting authentication state in tests.
 *
 * @param page - Page object
 * @returns Promise<boolean> - true if authenticated
 *
 * @example
 * ```typescript
 * const page = await getFirstWindow(app);
 * const isAuth = await verifyAuthenticated(page);
 * expect(isAuth).toBe(true);
 * ```
 */
export async function verifyAuthenticated(page: Page): Promise<boolean> {
  try {
    const authState = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      return await api.auth.getAuthState();
    });
    return authState.isAuthenticated === true;
  } catch (error) {
    console.error('Failed to verify authentication:', error);
    return false;
  }
}

/**
 * Get the authenticated user profile
 *
 * @param page - Page object
 * @returns User profile or null if not authenticated
 */
export async function getAuthenticatedUser(page: Page): Promise<{
  id: string;
  email: string;
  name: string;
  organizationId?: string;
} | null> {
  try {
    const authState = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      return await api.auth.getAuthState();
    });
    return authState.user || null;
  } catch (error) {
    console.error('Failed to get authenticated user:', error);
    return null;
  }
}
