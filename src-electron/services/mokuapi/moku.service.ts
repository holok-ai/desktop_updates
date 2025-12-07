/* eslint-disable @typescript-eslint/require-await */
/**
 * Moku Service
 * - Handles all API calls to Moku backend
 * - Manages authentication endpoints (exchange code, token refresh)
 * - Memory-only store for available models returned by Moku
 * - Provides a simple API for listing and querying models
 */

import { getSettingsService } from '../../ipc-handlers/settings-handler.js';
import { getAuthService } from '../../ipc-handlers/auth-handler.js';
import log from 'electron-log';
import type { ApplicationSummary } from './application.types.js';
import type { PagedResponse } from './paging.types.js';
import type { AgentListItem } from './agent.types.js';

export interface MokuModel {
  provider: string;
  id: string;
  title: string;
  description?: string;
  available: boolean;
  default?: boolean;
  createdAt: number;
}

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
    log.info('[MokuService] Exchanging code for apiKey');

    const mokuApiUrl = this.getMokuApiUrl();

    const response = await fetch(`${mokuApiUrl}/api/auth/exchange-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('[MokuService] Exchange code failed:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Invalid or expired exchange code. Please try logging in again.');
      }
      throw new Error(`Failed to exchange code: ${response.status}`);
    }

    const { apiKey } = (await response.json()) as ExchangeCodeResponse;
    log.info('[MokuService] Successfully received apiKey');

    return apiKey;
  }

  /**
   * Exchange apiKey for accessToken
   * Step 2 of authentication flow and used for token refresh
   */
  public async exchangeApiKeyForAccessToken(
    apiKey: string,
  ): Promise<{ accessToken: string; expires_in: number }> {
    log.info('[MokuService] Exchanging apiKey for accessToken');

    const mokuApiUrl = this.getMokuApiUrl();

    const response = await fetch(`${mokuApiUrl}/api/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('[MokuService] Token refresh failed:', response.status, errorText);
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const { accessToken, expires_in } = (await response.json()) as TokenRefreshResponse;
    log.info('[MokuService] Successfully received accessToken');

    return { accessToken, expires_in };
  }

  /** Simulate refreshing model list from Moku (no-op in-memory) */
  public async refreshFromMoku(): Promise<void> {
    // In a real implementation this would call Moku API using auth tokens.
    // For the in-memory service we keep the seeded list; method provided for parity.

    void 0;
  }

  public async getAllAgents(): Promise<AgentListItem[]> {
    const mokuApiUrl = this.getMokuApiUrl();
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      log.error('[MokuService] No access token available');
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
  /**
   * Get all applications from Moku API with pagination support
   * Fetches all pages and returns a complete list of applications
   */
  public async getAllApplications(): Promise<ApplicationSummary[]> {
    log.info('[MokuService] Fetching all applications');

    const mokuApiUrl = this.getMokuApiUrl();
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      log.error('[MokuService] No access token available');
      throw new Error('Not authenticated. Please log in first.');
    }

    let allApps: ApplicationSummary[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        log.info(`[MokuService] Fetching applications page ${page}`);

        const response = await fetch(`${mokuApiUrl}/api/applications?page=${page}&size=1000`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          log.error('[MokuService] Get applications failed:', response.status, errorText);

          if (response.status === 401) {
            throw new Error('Authentication failed. Please log in again.');
          }
          throw new Error(`Failed to get applications: ${response.status}`);
        }

        const data = (await response.json()) as PagedResponse<ApplicationSummary>;

        allApps = allApps.concat(data.content);
        hasMore = data.hasNext;
        page++;

        log.info(
          `[MokuService] Fetched ${data.content.length} applications (page ${data.page + 1}/${data.totalPages})`,
        );
      } catch (error) {
        log.error('[MokuService] Error fetching applications:', error);
        throw error;
      }
    }

    log.info(`[MokuService] Successfully fetched ${allApps.length} total applications`);

    // Convert arrays to Sets for modelNames, guards, and evaluators
    return allApps.map((app) => ({
      ...app,
      modelNames: new Set(app.modelNames as unknown as string[]),
      guards: app.guards ? new Set(app.guards as unknown as string[]) : undefined,
      evaluators: app.evaluators ? new Set(app.evaluators as unknown as string[]) : undefined,
    }));
  }
}

// Export a singleton instance for simple usage in the rest of the app
export const mokuService = new MokuService();

export default MokuService;
