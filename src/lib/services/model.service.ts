/**
 * Model Service
 * Provides information about available LLM models and their capabilities
 * Uses ModelRepository via IPC to fetch models from Moku API
 */

import type { ModelsByProvider } from '$lib/types/dashboard.type';

class ModelService {
  /**
   * Get all available models grouped by provider
   */
  async getAvailableModels(): Promise<ModelsByProvider> {
    try {
      // Fetch models from backend via IPC
      const models = await window.electronAPI.models.listAll();

      // Group models by provider
      const modelsByProvider: ModelsByProvider = {};

      for (const model of models) {
        const provider = model.provider || 'Unknown';

        if (!modelsByProvider[provider]) {
          modelsByProvider[provider] = [];
        }

        // Use accessName (e.g., gpt-4, claude-3) as the model identifier
        modelsByProvider[provider].push(model.accessName);
      }

      return modelsByProvider;
    } catch (error) {
      console.error('[ModelService] Error fetching models:', error);
      // Return empty object on error
      return {};
    }
  }

  /**
   * Get models for a specific provider
   */
  async getProviderModels(provider: string): Promise<string[]> {
    const models = await this.getAvailableModels();
    return models[provider] || [];
  }

  /**
   * Get list of all provider names
   */
  async getProviders(): Promise<string[]> {
    const models = await this.getAvailableModels();
    return Object.keys(models);
  }
}

// Export singleton instance
export const modelService = new ModelService();
