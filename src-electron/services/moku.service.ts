/* eslint-disable @typescript-eslint/require-await */
/**
 * Moku Service
 * - Handles all API calls to Moku backend
 * - Manages authentication endpoints (exchange code, token refresh)
 * - Memory-only store for available models returned by Moku
 * - Provides a simple API for listing and querying models
 */

import { randomUUID } from 'crypto';
import { getSettingsService } from '../ipc-handlers/settings-handler.js';
import log from 'electron-log';

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
  private models: MokuModel[] = [];

  constructor() {
    this.seedModels();
  }

  /** Seed with a few example models to simulate Moku responses */
  private seedModels(): void {
    const now = Date.now();
    this.models = [
      {
        provider: 'openai',
        id: randomUUID(),
        title: 'GPT-4o',
        description: 'High-capacity conversational model',
        available: true,
        default: true,
        createdAt: now,
      },
      {
        provider: 'openai',
        id: randomUUID(),
        title: 'GPT-4o-mini',
        description: 'Lower-cost variant',
        available: true,
        createdAt: now,
      },
      {
        provider: 'moku',
        id: randomUUID(),
        title: 'Moku-BERT',
        description: 'Example Moku model (unavailable)',
        available: false,
        createdAt: now,
      },
    ];
  }

  /** Return a shallow clone of all known models (including unavailable) */
  public async listModelsForUser(_userId?: string): Promise<MokuModel[]> {
    return this.models.map((m) => ({
      provider: m.provider,
      id: m.id,
      title: m.title,
      description: m.description,
      available: m.available,
      default: m.default,
      createdAt: m.createdAt,
    }));
  }

  /** Return only available models (used by the UI chooser) */
  public async listAvailableModelsForUser(_userId?: string): Promise<MokuModel[]> {
    return this.models
      .filter((m) => m.available)
      .map((m) => ({
        provider: m.provider,
        id: m.id,
        title: m.title,
        description: m.description,
        available: m.available,
        default: m.default,
        createdAt: m.createdAt,
      }));
  }

  /** Lookup a model by provider + id */
  public async getModel(provider: string, id: string): Promise<MokuModel | undefined> {
    const found = this.models.find((m) => m.provider === provider && m.id === id);
    return found
      ? {
          provider: found.provider,
          id: found.id,
          title: found.title,
          description: found.description,
          available: found.available,
          default: found.default,
          createdAt: found.createdAt,
        }
      : undefined;
  }

  /**
   * Get Moku API URL from settings
   */
  private getMokuApiUrl(): string {
    const settingsService = getSettingsService();
    return settingsService.getMokuApiUrl();
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
}

// Export a singleton instance for simple usage in the rest of the app
export const mokuService = new MokuService();

export default MokuService;
