import { mokuService } from '../services/mokuapi/moku.service.js';
import { getSettingsService } from '../ipc-handlers/settings-handler.js';
import log from 'electron-log';
import type { ApplicationSummary, ModelDetails } from '../preload.js';

export class ModelRepository {
  private readonly agents: ApplicationSummary[] = [];
  private readonly models: ModelDetails[] = [];
  private holoApiUrl: string = '';
  private isRefreshing: boolean = false;

  public getModel(modelId: string): ModelDetails | undefined {
    return this.models.find((m) => m.id === modelId);
  }

  /**
   * Get Holo API URL from settings
   */
  public getHoloApiUrl(): string {
    if (this.holoApiUrl) {
      return this.holoApiUrl;
    }

    try {
      log.info('[ModelRepository] Fetching Holo API URL from settings');
      const settingsService = getSettingsService();
      this.holoApiUrl = settingsService.getHoloApiUrl();

      return this.holoApiUrl;
    } catch (error) {
      log.error('[ModelRepository] Failed to fetch Holo API URL from agent details:', error);

      // Fall back to settings service
      const settingsService = getSettingsService();
      return settingsService.getHoloApiUrl();
    }
  }

  public buildCustomUrl(provider: string, agentSlug: string): string {
    const holoApiUrl: string = this.getHoloApiUrl();
    return holoApiUrl + '/api/custom/' + provider + '/' + agentSlug;
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
      // Clear existing models
      this.agents.length = 0;
      this.models.length = 0;

      const agents = await mokuService.getAllAgents();
      log.info(`[ModelRepository] Read  ${agents.length} agents from Moku`);

      for (const thisAgent of agents) {
        const mappedProvider = thisAgent.provider === 'anthropic' ? 'claude' : thisAgent.provider;
        const agentUrl: string = this.buildCustomUrl(mappedProvider, thisAgent.urlSlug);

        var appSummary: ApplicationSummary = {
          id: thisAgent.id,
          description: thisAgent.description,
          slug: thisAgent.urlSlug,
          title: thisAgent.name,
          provider: thisAgent.provider,
          url: agentUrl,
          models: [],
        };

        if (thisAgent.models && thisAgent.models.length > 0) {
          for (const model of thisAgent.models) {
            const modelDetails: ModelDetails = {
              id: model.id,
              title: model.name,
              accessName: model.accessModel,
              provider: thisAgent.provider,
              applicationName: appSummary.title,
              applicationSlug: appSummary.slug,
              slug: thisAgent.urlSlug,
              url: agentUrl,
              isPublic: model.isPublic,
              intendedUse: model.intendedUse,
            };
            this.models.push(modelDetails);
            appSummary.models?.push(modelDetails);
          }
        }
        this.agents.push(appSummary);
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

      log.info(
        `[ModelRepository] Successfully loaded ${this.models.length} models from ${this.agents.length} applications (removed ${duplicatesCount} duplicates)`,
      );
    } catch (error) {
      log.error('[ModelRepository] Failed to refresh models from Moku:', error);
      // Don't throw - allow application to continue even if model refresh fails
    } finally {
      this.isRefreshing = false;
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
    if (this.agents.length > 0) {
      log.info(`[ModelRepository] Returning ${this.agents.length} cached applications`);
      // Return deep copy to prevent modifications to cached data
      return this.agents.map((app) => ({
        ...app,
        models: app.models ? [...app.models] : [],
      }));
    }

    // Fetch applications from Moku if cache is empty
    log.info('[ModelRepository] Cache empty, fetching applications from Moku API');
    await this.refreshModels();

    // Return deep copy to prevent modifications to cached data
    return this.agents.map((app) => ({
      ...app,
      models: app.models ? [...app.models] : [],
    }));
  }

  /*
   */
  public async getAgentById(agentId: string): Promise<ApplicationSummary | null> {
    // Ensure cache is populated
    if (this.agents.length === 0) {
      log.info('[ModelRepository] Cache empty, fetching applications from Moku API');
      await this.refreshModels();
    }

    // Find application by ID or slug
    const agent = this.agents.find((a) => a.id === agentId);

    if (!agent) {
      log.warn(`[ModelRepository] Agent application not found: ${agentId}`);
      return null;
    }
    return agent;
  }

  /**
   * Get models for a specific application by application ID
   */
  public async getModelsForApplication(applicationId: string): Promise<ModelDetails[]> {
    // Ensure cache is populated
    if (this.agents.length === 0) {
      log.info('[ModelRepository] Cache empty, fetching applications from Moku API');
      await this.refreshModels();
    }

    // Find application by ID or slug
    const app = this.agents.find((a) => a.id === applicationId || a.slug === applicationId);

    if (!app) {
      log.warn(`[ModelRepository] Application not found: ${applicationId}`);
      return [];
    }

    // Return deep copy to prevent modifications to cached data
    return app.models ? [...app.models] : [];
  }
}

// Singleton instance
export const modelRepository = new ModelRepository();
