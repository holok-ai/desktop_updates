/**
 * Model Service
 * Provides information about available LLM models and their capabilities
 * Uses ModelRepository via IPC to fetch models from Moku API
 */

import type { ApplicationSummary, ModelDetails } from '../../../src-electron/preload';

class ModelService {
  /**
   * Get all available models as a flat list
   */
  async getAvailableModels(): Promise<ModelDetails[]> {
    const result = await window.electronAPI.models.listAllModels();
    if (result.success) {
      return result.data;
    }
    console.error('[ModelService] Error fetching models:', result.errorCode, result.errorText);
    return [];
  }

  /**
   * Get models for a specific provider
   */
  async getProviderModels(provider: string): Promise<ModelDetails[]> {
    const models = await this.getAvailableModels();
    return models.filter((m) => m.provider === provider);
  }

  /**
   * Get list of all provider names
   */
  async getProviders(): Promise<string[]> {
    const models = await this.getAvailableModels();
    return [...new Set(models.map((m) => m.provider))];
  }

  /**
   * Get all available applications with their models
   */
  async getAvailableApplications(): Promise<ApplicationSummary[]> {
    const result = await window.electronAPI.models.listAllApplications();
    if (result.success) {
      return result.data;
    }
    console.error(
      '[ModelService] Error fetching applications:',
      result.errorCode,
      result.errorText,
    );
    return [];
  }

  /**
   * Get models for a specific application/agent
   */
  async getModelsForApplication(applicationId: string): Promise<ModelDetails[]> {
    const result = await window.electronAPI.models.getModelsForApplication(applicationId);
    if (result.success) {
      return result.data;
    }
    console.error(
      '[ModelService] Error fetching models for application:',
      result.errorCode,
      result.errorText,
    );
    return [];
  }
}

// Export singleton instance
export const modelService = new ModelService();
