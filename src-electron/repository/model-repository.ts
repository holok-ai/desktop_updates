import { mokuService } from '../services/mokuapi/moku.service.js';
import { getSettingsService } from '../ipc-handlers/settings-handler.js';
import log from 'electron-log';
import type { ModelDetails } from '../preload.js';

export class ModelRepository {
  private readonly models: ModelDetails[] = [];
  private holoApiUrl: string = '';

  public getModel(modelId: string): ModelDetails | undefined {
    return this.models.find((m) => m.id === modelId);
  }

  /**
   * Get Holo API URL from agent chat configuration
   * Fetches the first agent and extracts the URL from its chat config
   */
  public async getHoloApiUrl(): Promise<string> {
    // Return cached URL if available
    if (this.holoApiUrl) {
      return this.holoApiUrl;
    }

    try {
      log.info('[ModelRepository] Fetching Holo API URL from agent details');

      // Get all agents
      const agents = await mokuService.getAllAgents();

      if (agents.length === 0) {
        log.warn('[ModelRepository] No agents found, falling back to settings');
        const settingsService = getSettingsService();
        return settingsService.getMokuApiUrl();
      }

      // Get details for the first agent
      const firstAgent = agents[0];
      log.info(`[ModelRepository] Fetching details for agent: ${firstAgent.name}`);

      const agentDetail = await mokuService.getAgentDetail(firstAgent.id);

      // Extract and cache the Holo API URL from the agent chat config
      this.holoApiUrl = agentDetail.url;
      log.info(`[ModelRepository] Holo API URL set to: ${this.holoApiUrl}`);

      return this.holoApiUrl;
    } catch (error) {
      log.error('[ModelRepository] Failed to fetch Holo API URL from agent details:', error);

      // Fall back to settings service
      const settingsService = getSettingsService();
      return settingsService.getMokuApiUrl();
    }
  }

  /**
   * Refresh models from Moku API after authentication
   * Called automatically after successful login
   */
  public async refreshModels(): Promise<void> {
    log.info('[ModelRepository] Refreshing models from Moku API');
    try {
      // Get all application summaries
      const applications = await mokuService.getAllApplications();
      log.info(`[ModelRepository] Found ${applications.length} applications`);

      // Clear existing models
      this.models.length = 0;

      // Fetch application details for each application and extract models
      for (const app of applications) {
        try {
          log.info(`[ModelRepository] Fetching details for application: ${app.name}`);
          const appDetail = await mokuService.getApplicationDetail(app.id);
          const agentDetail = await mokuService.getAgentDetail(app.id);

          // Extract models from application detail
          if (appDetail.models && appDetail.models.length > 0) {
            for (const model of appDetail.models) {
              const modelDetails: ModelDetails = {
                id: model.id,
                title: model.name,
                accessName: model.accessModel,
                provider: agentDetail ? agentDetail.provider : '',
                slug: appDetail.urlSlug,
                url: agentDetail ? agentDetail.url : '',
              };
              this.models.push(modelDetails);
              log.info(
                `[ModelRepository] Added model: ${model.name} (${model.accessModel}) from ${agentDetail.provider}`,
              );
            }
          }
        } catch (error) {
          log.error(
            `[ModelRepository] Failed to fetch details for application ${app.name}:`,
            error,
          );
          // Continue with other applications
        }
      }

      log.info(
        `[ModelRepository] Successfully loaded ${this.models.length} models from ${applications.length} applications`,
      );
    } catch (error) {
      log.error('[ModelRepository] Failed to refresh models from Moku:', error);
      // Don't throw - allow application to continue even if model refresh fails
    }
  }

  public async listAll(): Promise<ModelDetails[]> {
    // Return cached models if already loaded
    if (this.models.length > 0) {
      log.info(`[ModelRepository] Returning ${this.models.length} cached models`);
      return [...this.models]; // Return copy
    }

    // Fetch applications from Moku if cache is empty
    log.info('[ModelRepository] Cache empty, fetching models from Moku API');
    await this.refreshModels();

    return [...this.models]; // Return copy
  }
}

// Singleton instance
export const modelRepository = new ModelRepository();
