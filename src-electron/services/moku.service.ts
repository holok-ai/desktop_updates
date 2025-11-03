/* eslint-disable @typescript-eslint/require-await */
/**
 * In-memory Moku service (Moku API stub)
 * - Memory-only store for available models returned by Moku
 * - Provides a simple API for listing and querying models
 * - Intended for UI integration and tests; no external network calls
 */

import { randomUUID } from 'crypto';

export interface MokuModel {
  provider: string;
  id: string;
  title: string;
  description?: string;
  available: boolean;
  default?: boolean;
  createdAt: number;
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
