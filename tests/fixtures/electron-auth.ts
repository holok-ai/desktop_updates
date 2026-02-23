/**
 * Electron Authentication Fixture for E2E Tests
 *
 * Provides centralized authentication using PLAYWRIGHT_TEST_TOKENS environment variable.
 * This approach eliminates the need for UI-based login interactions in tests.
 *
 * @see tests/e2e/README-auth-test-key.md for detailed documentation
 */

import { _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { ensureValidToken, refreshTokenViaElectron } from '../helpers/token-helpers.js';

/**
 * Test credentials with long-lived apiKey (expires 2036)
 * The accessToken has a 24h window; once expired, the apiKey handles refresh automatically.
 *
 * Security Note:
 * - Only work in test environment
 * - Do not overwrite real user credentials
 * - Exist in-memory only when PLAYWRIGHT_TEST_TOKENS is set
 * - Real tokens remain in encrypted storage untouched
 */
export const TEST_TOKENS = {
  accessToken:
    'eyJhbGciOiJIUzM4NCJ9.eyJ1c2VySWQiOiJrb25nLnBoYW1AbmtrdGVjaC5jb20iLCJvcmdhbml6YXRpb25JZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSIsImFwcFNsdWdzIjpbImFmOGFlYzNjIiwiZjY4N2I0OWYiXSwic3ViIjoiMTEzYWI3ODUtY2U5Ni00ZDY5LTgxNjktOTkwNzk2NmMyM2NkIiwiaXNzIjoibW9rdS1hcGkiLCJpYXQiOjE3NzE4MzE0NDYsImV4cCI6MTc3MTkxNzg0Nn0.1RZm4StgmUlRxB9SEwrcLXyxDGswLDAboIbQzdkYxNuLQ3IJzXkSKjq5Gduv9qgS',
  apiKey:
    'eyJhbGciOiJIUzM4NCJ9.eyJ1c2VySWQiOiJrb25nLnBoYW1AbmtrdGVjaC5jb20iLCJvcmdhbml6YXRpb25JZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSIsInN1YiI6IjExM2FiNzg1LWNlOTYtNGQ2OS04MTY5LTk5MDc5NjZjMjNjZCIsImlzcyI6Im1va3UtYXBpIiwiaWF0IjoxNzcxODMxNTEzLCJleHAiOjIwODczNjQzMTN9.IWTklIGD2FkEhkvDYqmQN9QFpISoYlN1o6a6L6OBSnpAM7U4H5R4hhe2SkShfgNX',
  user: {
    id: '19451f75-d9f6-4da2-b17b-af3b649e6fe8',
    email: 'kong.pham@nkk.com.vn',
    name: 'Kong Pham',
    organizationId: '00000000-0000-0000-0000-000000000001',
  },
  expiresAt: 1770980452000, // exp from JWT - will trigger refresh via apiKey when expired
};

/**
 * Launch Electron app with pre-authenticated test user
 *
 * Authentication happens automatically at app startup via AuthService.loadTestTokens()
 * The expired access token will be automatically refreshed by AuthService.getAccessToken()
 * when the first API call is made. No manual token refresh needed.
 *
 * **Cross-Platform Support:**
 * - Uses command-line args for Windows compatibility (env vars don't propagate reliably)
 * - Falls back to env vars for backward compatibility
 *
 * **Command-Line Override:**
 * You can override the API key from command line:
 * ```bash
 * # Windows PowerShell
 * $env:TEST_API_KEY="your-api-key-here"; npm run test:e2e -- tests/e2e/auth-test-key.spec.ts
 *
 * # Windows CMD
 * set TEST_API_KEY=your-api-key-here && npm run test:e2e -- tests/e2e/auth-test-key.spec.ts
 *
 * # macOS/Linux
 * TEST_API_KEY=your-api-key-here npm run test:e2e -- tests/e2e/auth-test-key.spec.ts
 * ```
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
 *   // Token will be auto-refreshed on first API call
 * });
 * ```
 */
export async function launchAuthenticatedApp(): Promise<ElectronApplication> {
  // Allow overriding API key from command line
  const apiKeyOverride = process.env.TEST_API_KEY;
  const accessTokenOverride = process.env.TEST_ACCESS_TOKEN;

  const testTokens = {
    ...TEST_TOKENS,
    ...(apiKeyOverride && { apiKey: apiKeyOverride }),
    ...(accessTokenOverride && { accessToken: accessTokenOverride }),
  };

  const testTokensJson = JSON.stringify(testTokens);

  if (apiKeyOverride) {
    console.log('[E2E] Using API key from TEST_API_KEY environment variable');
  }
  if (accessTokenOverride) {
    console.log('[E2E] Using access token from TEST_ACCESS_TOKEN environment variable');
  }

  // Configure environment for E2E tests
  const testEnv = {
    ...process.env,
    PLAYWRIGHT_TEST_TOKENS: testTokensJson,
  };

  try {
    // Try launching from source (development)
    const electronExec = (await import('electron')).default as unknown as string;
    return await electron.launch({
      executablePath: electronExec,
      args: [
        '.',
        // Pass test tokens via command line for Windows compatibility
        // This is more reliable than env vars on Windows
        `--playwright-test-tokens=${testTokensJson}`,
      ],
      env: testEnv, // Keep env var for backward compatibility
    });
  } catch {
    // Fallback to built version (production)
    const electronExec = (await import('electron')).default as unknown as string;
    return await electron.launch({
      executablePath: electronExec,
      args: [
        'dist-electron/main.js',
        // Pass test tokens via command line for Windows compatibility
        `--playwright-test-tokens=${testTokensJson}`,
      ],
      env: testEnv, // Keep env var for backward compatibility
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

/**
 * Refresh the access token
 *
 * Uses the same token refresh logic as the production AuthService.
 * Useful when testing with expired tokens or long-running tests.
 *
 * @param page - Page object
 * @returns Promise with refreshed auth state
 *
 * @example
 * ```typescript
 * // Refresh token before making API calls
 * await refreshAccessToken(page);
 * ```
 */
export async function refreshAccessToken(page: Page): Promise<void> {
  await refreshTokenViaElectron(page);
}

/**
 * Ensure the access token is valid, refreshing if needed
 *
 * This is a convenience function that checks token validity and
 * refreshes automatically if expired.
 *
 * @param page - Page object
 * @returns Promise with valid access token
 *
 * @example
 * ```typescript
 * // Before making API calls in tests
 * const token = await ensureValidAccessToken(page);
 * ```
 */
export async function ensureValidAccessToken(page: Page): Promise<string> {
  return ensureValidToken(page);
}
