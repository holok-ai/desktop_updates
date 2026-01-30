/**
 * Token Refresh Utility
 *
 * Shared logic for refreshing access tokens using apiKey.
 * Can be used by both AuthService and E2E tests.
 */

import log from 'electron-log';
import { mokuService } from '../services/mokuapi/moku.service.js';

export interface TokenRefreshResult {
  accessToken: string;
  expiresAt: number;
}

export interface TokenRefreshInput {
  apiKey: string;
  currentExpiresAt?: number;
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
 * Refresh access token using apiKey
 *
 * This function:
 * 1. Checks if the current token is still valid (if expiresAt provided)
 * 2. If expired or not provided, exchanges apiKey for new access token
 * 3. Returns new token with calculated expiration time
 *
 * @param input - Token refresh input containing apiKey and optional current expiresAt
 * @returns Promise with new access token and expiration timestamp
 * @throws Error if apiKey is invalid or API call fails
 *
 * @example
 * ```typescript
 * // Refresh token
 * const result = await refreshAccessToken({
 *   apiKey: 'your-api-key',
 *   currentExpiresAt: Date.now() - 1000 // Expired token
 * });
 *
 * console.log(result.accessToken); // New access token
 * console.log(result.expiresAt); // New expiration timestamp
 * ```
 */
export async function refreshAccessToken(input: TokenRefreshInput): Promise<TokenRefreshResult> {
  const { apiKey, currentExpiresAt } = input;

  // Check if current token is still valid
  if (currentExpiresAt && isTokenValid(currentExpiresAt)) {
    log.info('[TokenRefresh] Current token is still valid, skipping refresh');
    throw new Error('Token is still valid, refresh not needed');
  }

  if (!apiKey) {
    log.error('[TokenRefresh] No apiKey provided for token refresh');
    throw new Error('apiKey is required for token refresh');
  }

  try {
    log.info('[TokenRefresh] Exchanging apiKey for new access token');

    const { accessToken, expires_in } = await mokuService.exchangeApiKeyForAccessToken(apiKey);

    // Calculate expiration with 1-minute safety buffer
    const expiresAt = Date.now() + expires_in * 1000 - 60 * 1000;

    log.info('[TokenRefresh] Successfully refreshed access token');

    return {
      accessToken,
      expiresAt,
    };
  } catch (error) {
    log.error('[TokenRefresh] Failed to refresh access token:', error);
    throw new Error(
      `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Get access token, refreshing if needed
 *
 * This is a convenience function that:
 * 1. Checks if current token is valid
 * 2. If valid, returns it immediately
 * 3. If expired, refreshes and returns new token
 *
 * @param currentToken - Current access token (may be expired)
 * @param apiKey - API key for refreshing
 * @param expiresAt - When current token expires
 * @returns Promise with valid access token and expiration
 *
 * @example
 * ```typescript
 * const result = await getValidAccessToken(
 *   'current-token',
 *   'api-key',
 *   Date.now() + 3600000
 * );
 * ```
 */
export async function getValidAccessToken(
  currentToken: string,
  apiKey: string,
  expiresAt: number,
): Promise<TokenRefreshResult> {
  // If token is still valid, return it
  if (isTokenValid(expiresAt)) {
    log.info('[TokenRefresh] Current token is valid, no refresh needed');
    return {
      accessToken: currentToken,
      expiresAt,
    };
  }

  // Token expired, refresh it
  log.info('[TokenRefresh] Token expired, refreshing...');
  return refreshAccessToken({ apiKey, currentExpiresAt: expiresAt });
}
