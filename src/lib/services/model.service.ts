/* eslint-disable security/detect-object-injection */
/**
 * Model Service
 * Provides information about available LLM models and their capabilities
 * Uses ModelRepository via IPC to fetch models from Moku API
 */

import type { ModelsByProvider } from '$lib/types/dashboard.type';
import type { ApplicationSummary } from '../../../src-electron/preload';

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
        const provider =
          model.provider !== null && model.provider !== '' ? model.provider : 'Unknown';

        if (!(provider in modelsByProvider)) {
          modelsByProvider[provider] = [];
        }

        // Use accessName (e.g., gpt-4, claude-3) as the model identifier
        if (provider in modelsByProvider) {
          modelsByProvider[provider].push(model.accessName);
        }
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
    return provider in models ? models[provider] : [];
  }

  /**
   * Get list of all provider names
   */
  async getProviders(): Promise<string[]> {
    const models = await this.getAvailableModels();
    return Object.keys(models);
  }

  /**
   * Get all available applications with their models
   */
  async getAvailableApplications(): Promise<ApplicationSummary[]> {
    try {
      // Fetch applications from backend via IPC
      const applications = await window.electronAPI.models.listAllApplications();
      return applications;
    } catch (error) {
      console.error('[ModelService] Error fetching applications:', error);
      // Return empty array on error
      return [];
    }
  }
}

// Export singleton instance
export const modelService = new ModelService();
