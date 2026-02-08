import { mokuService } from '../services/mokuapi/moku.service.js';
import { getSettingsService } from '../ipc-handlers/settings-handler.js';
import log from 'electron-log';
import type { ApplicationSummary, ModelDetails } from '../preload.js';
import { ModelReference } from '../services/mokuapi/application.types.js';

export class ModelRepository {
  private readonly apps: ApplicationSummary[] = [];
  private readonly models: ModelDetails[] = [];
  private holoApiUrl: string = '';
  private isRefreshing: boolean = false;

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
    // Prevent concurrent refresh calls
    if (this.isRefreshing) {
      log.info('[ModelRepository] Refresh already in progress, skipping');
      return;
    }

    this.isRefreshing = true;
    log.info('[ModelRepository] Refreshing models from Moku API');
    try {
        const settingsService = getSettingsService();
        const holoApiUrl: string = settingsService.getHoloApiUrl();

      // Get all application summaries
      const applications = await mokuService.getAllApplications();
      log.info(`[ModelRepository] Found ${applications.length} applications`);

      // Clear existing models
      this.apps.length = 0; 
      this.models.length = 0;

      // Fetch application details for each application and extract models
      for (const app of applications) {
        try {
          const appDetail = await mokuService.getApplicationDetail(app.id);
          const agentUrl: string  = holoApiUrl + "/api/custom/" + app.providerName + "/" + app.urlSlug; 
          var appSummary: ApplicationSummary = {
            id: appDetail.id,
            slug: app.urlSlug, 
            title: appDetail.name, 
            provider: appDetail.providerName,
            url: agentUrl , 
            models: []
          };
          console.log("App summary: ", appDetail.name, appDetail.providerName, appSummary.url); 

          appSummary.models = [];

          // Extract models from application detail
          if (appDetail.models && appDetail.models.length > 0) {
            for (const model of appDetail.models) {
 
              const modelDetails: ModelDetails = {
                id: model.id,
                title: model.name,
                accessName: model.accessModel,
                provider: appDetail.providerName,
                slug: appDetail.urlSlug,
                url: agentUrl
              };
              this.models.push(modelDetails);
              appSummary.models?.push(modelDetails);
            }
          }
          this.apps.push(appSummary); 
        } catch (error) {
          log.error(`[ModelRepository] Failed to fetch details for application ${app.name}:`, error);
          // Continue with other applications
        }
      }

      // Deduplicate models by provider + accessName combination
      const seenModels = new Map<string, boolean>();
      const uniqueModels: ModelDetails[] = [];

      for (const model of this.models) {
        const key = `${model.provider}:${model.accessName}`;
        if (!seenModels.has(key)) {
          seenModels.set(key, true);
          uniqueModels.push(model);
        } else {
          log.debug(
            `[ModelRepository] Skipping duplicate model: ${model.title} (${model.accessName}) from ${model.provider}`,
          );
        }
      }

      // Replace models array with deduplicated version
      const duplicatesCount = this.models.length - uniqueModels.length;
      this.models.length = 0;
      this.models.push(...uniqueModels);

      log.info(`[ModelRepository] Successfully loaded ${this.models.length} models from ${applications.length} applications (removed ${duplicatesCount} duplicates)`);
    } catch (error) {
      log.error('[ModelRepository] Failed to refresh models from Moku:', error);
      // Don't throw - allow application to continue even if model refresh fails
    } finally {
      this.isRefreshing = false;
    }
  }

 private  getEndpoint(modelReference: ModelReference): string {
    try {
      if (!modelReference || ! modelReference.metadata) 
        return ''; 

      // Extract endpoint value using regex
      const match = modelReference.metadata.match(/endpoint[=:]([^,}]+)/);
      if (match) {
        let endpoint = match[1].trim().replace(/["']/g, ''); // Remove quotes

        if (endpoint && !endpoint.startsWith('/')) {
          endpoint = '/' + endpoint;
        }
        return endpoint;
      }
      return '';
    } catch (error) {
      console.error('Failed to parse metadata:', error);
      return '';
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

  public async listAllApplications(): Promise<ApplicationSummary[]> {
    // Return cached applications if already loaded
    if (this.apps.length > 0) {
      log.info(`[ModelRepository] Returning ${this.apps.length} cached applications`);
      // Return deep copy to prevent modifications to cached data
      return this.apps.map(app => ({
        ...app,
        models: app.models ? [...app.models] : []
      }));
    }

    // Fetch applications from Moku if cache is empty
    log.info('[ModelRepository] Cache empty, fetching applications from Moku API');
    await this.refreshModels();

    // Return deep copy to prevent modifications to cached data
    return this.apps.map(app => ({
      ...app,
      models: app.models ? [...app.models] : []
    }));
  }
}

// Singleton instance
export const modelRepository = new ModelRepository();
