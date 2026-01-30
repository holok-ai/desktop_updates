/**
 * Token Helper Functions for E2E Tests
 *
 * Provides utilities for managing authentication tokens in E2E tests,
 * including token refresh logic that mirrors the production AuthService.
 */

import type { Page } from 'playwright';

export interface TestTokens {
  accessToken: string;
  apiKey: string;
  expiresAt: number;
  user?: {
    id: string;
    email: string;
    name?: string;
    organizationId?: string;
  };
}

/**
 * Check if a token is still valid
 *
 * @param expiresAt - Unix timestamp when token expires
 * @returns true if token is still valid, false if expired
 */
export function isTokenValid(expiresAt: number): boolean {
  return expiresAt > Date.now();
}

/**
 * Refresh access token using the Electron app's token refresh mechanism
 *
 * This calls into the Electron app's AuthService to refresh the token,
 * ensuring the same logic is used in tests as in production.
 *
 * @param page - Playwright page object
 * @returns Promise with refreshed auth state
 *
 * @example
 * ```typescript
 * const authState = await refreshTokenViaElectron(page);
 * console.log('New token:', authState.tokens.accessToken);
 * ```
 */
export async function refreshTokenViaElectron(page: Page): Promise<{
  user: any;
  tokens: {
    accessToken: string;
    apiKey?: string;
    expiresAt: number;
  };
  isAuthenticated: boolean;
}> {
  try {
    // Wait for page to be stable before evaluating
    await page.waitForLoadState('domcontentloaded');

    const authState = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      if (!api || !api.auth) {
        throw new Error('electronAPI not available');
      }

      // Call the AuthService's refresh method via IPC
      await api.auth.refreshToken();

      // Get the updated auth state
      return await api.auth.getAuthState();
    });

    return authState;
  } catch (error) {
    console.error('Failed to refresh token via Electron:', error);
    throw error;
  }
}

/**
 * Get current auth state from Electron app
 *
 * @param page - Playwright page object
 * @returns Promise with current auth state
 */
export async function getAuthState(page: Page): Promise<{
  user: any;
  tokens: {
    accessToken: string;
    apiKey?: string;
    expiresAt: number;
  } | null;
  isAuthenticated: boolean;
}> {
  try {
    // Wait for page to be stable before evaluating
    await page.waitForLoadState('domcontentloaded');

    const authState = await page.evaluate(async () => {
      const api = (window as any).electronAPI;
      if (!api || !api.auth) {
        throw new Error('electronAPI not available');
      }
      return await api.auth.getAuthState();
    });

    return authState;
  } catch (error) {
    console.error('Failed to get auth state:', error);
    throw error;
  }
}

/**
 * Ensure token is valid, refreshing if needed
 *
 * This is a convenience function that:
 * 1. Checks if current token is valid
 * 2. If expired, triggers a refresh
 * 3. Returns the valid token
 *
 * @param page - Playwright page object
 * @returns Promise with valid access token
 *
 * @example
 * ```typescript
 * // Before making API calls in tests
 * const token = await ensureValidToken(page);
 * // Use token for API requests
 * ```
 */
export async function ensureValidToken(page: Page): Promise<string> {
  const authState = await getAuthState(page);

  if (!authState.tokens) {
    throw new Error('Not authenticated');
  }

  // Check if token needs refresh
  if (!isTokenValid(authState.tokens.expiresAt)) {
    console.log('Token expired, refreshing...');
    const refreshedState = await refreshTokenViaElectron(page);
    return refreshedState.tokens.accessToken;
  }

  return authState.tokens.accessToken;
}

/**
 * Wait for token to be valid
 *
 * Useful when you need to ensure authentication is ready before proceeding.
 *
 * @param page - Playwright page object
 * @param timeoutMs - Maximum time to wait (default: 10000ms)
 * @returns Promise with valid access token
 */
export async function waitForValidToken(page: Page, timeoutMs: number = 10000): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const token = await ensureValidToken(page);
      return token;
    } catch (error) {
      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Failed to get valid token within ${timeoutMs}ms`);
}

/**
 * Check if token will expire soon
 *
 * @param expiresAt - Unix timestamp when token expires
 * @param bufferMs - Time buffer in milliseconds (default: 5 minutes)
 * @returns true if token will expire within the buffer time
 */
export function willExpireSoon(expiresAt: number, bufferMs: number = 5 * 60 * 1000): boolean {
  return expiresAt - Date.now() < bufferMs;
}
