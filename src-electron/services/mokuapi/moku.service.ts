/**
 * Moku Service
 * - Handles all API calls to Moku backend
 * - Manages authentication endpoints (exchange code, token refresh)
 * - Memory-only store for available models returned by Moku
 * - Provides a simple API for listing and querying models
 */

import { getSettingsService } from '../../ipc-handlers/settings-handler.js';
import { getAuthService } from '../../ipc-handlers/auth-handler.js';
import type { AgentListItem } from './agent.types.js';

/**
 * Response from /api/auth/exchange-code endpoint
 */
export interface ExchangeCodeResponse {
  apiKey: string;
}

/**
 * Response from /api/auth/token/refresh endpoint
 */
export interface TokenRefreshResponse {
  accessToken: string;
  expires_in: number;
}

export class MokuService {
  /**
   * Get Moku API URL from settings
   */
  private getMokuApiUrl(): string {
    const settingsService = getSettingsService();
    return settingsService.getMokuApiUrl();
  }

  /**
   * Get current access token from auth service
   */
  private getAccessToken(): string | null {
    const authService = getAuthService();
    const authState = authService.getAuthState();
    return authState.tokens?.accessToken || null;
  }

  /**
   * Exchange code for apiKey
   * Step 1 of authentication flow
   */
  public async exchangeCodeForApiKey(code: string): Promise<string> {
    const mokuApiUrl = this.getMokuApiUrl();

    const response = await fetch(`${mokuApiUrl}/api/auth/exchange-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid or expired exchange code. Please try logging in again.');
      }
      throw new Error(`Failed to exchange code: ${response.status} ${errorText}`);
    }

    const { apiKey } = (await response.json()) as ExchangeCodeResponse;
    return apiKey;
  }

  /**
   * Exchange apiKey for accessToken
   * Step 2 of authentication flow and used for token refresh
   */
  public async exchangeApiKeyForAccessToken(
    apiKey: string,
  ): Promise<{ accessToken: string; expires_in: number }> {
    const mokuApiUrl = this.getMokuApiUrl();

    const response = await fetch(`${mokuApiUrl}/api/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
    }

    const { accessToken, expires_in } = (await response.json()) as TokenRefreshResponse;

    return { accessToken, expires_in };
  }

  public async getAllAgents(): Promise<AgentListItem[]> {
    const mokuApiUrl = this.getMokuApiUrl();
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      throw new Error('Not authenticated. Please log in first.');
    }
    const response = await fetch(`${mokuApiUrl}/api/v1/agents`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as AgentListItem[];
  }
}

// Export a singleton instance for simple usage in the rest of the app
export const mokuService = new MokuService();

export default MokuService;
