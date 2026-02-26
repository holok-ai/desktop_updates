import { mokuService } from '../services/mokuapi/moku.service.js';
import { getSettingsService } from '../ipc-handlers/settings-handler.js';
import log from 'electron-log';
import type { ApplicationSummary, ModelDetails } from '../preload.js';
import { apiOk, apiFail, type ApiResponse } from '../types/api-response.js';

/** Check if running in Playwright E2E test mode (test tokens injected) */
function isE2ETestMode(): boolean {
  return !!process.env.PLAYWRIGHT_TEST_TOKENS;
}

/**
 * Return mock applications for E2E tests when API fails or returns empty.
 * Uses appSlugs from the test user's JWT when available.
 */
function getE2EMockApplications(): ApplicationSummary[] {
  const appSlugs = ['af8aec3c', 'f687b49f']; // From TEST_TOKENS JWT appSlugs
  const slug = appSlugs[0];
  const model: ModelDetails = {
    id: 'e2e-mock-model',
    title: 'E2E Mock Model',
    accessName: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    applicationName: 'E2E Test Assistant',
    applicationSlug: slug,
    slug,
    url: '',
    isPublic: true,
  };
  return [
    {
      id: slug,
      description: 'E2E test assistant for Playwright',
      title: 'E2E Test Assistant',
      provider: 'anthropic',
      slug,
      url: '',
      models: [model],
    },
  ];
}

export class ModelRepository {
  private readonly agents: ApplicationSummary[] = [];
  private readonly models: ModelDetails[] = [];
  private holoApiUrl: string = '';
  private isRefreshing: boolean = false;

  /**
   * Get Holo API URL from settings
   */
  public getHoloApiUrl(): string {
    if (this.holoApiUrl) {
      return this.holoApiUrl;
    }

    try {
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
  private async refreshModels(): Promise<ApiResponse<boolean>> {
    // Prevent concurrent refresh calls
    if (this.isRefreshing) {
      return apiOk(true);
    }

    this.isRefreshing = true;
    try {
      // Clear existing models
      this.agents.length = 0;
      this.models.length = 0;

      const agentsResult = await mokuService.getAllAgents();
      if (!agentsResult.success) {
        if (isE2ETestMode()) {
          log.warn(
            '[ModelRepository] E2E mode: API failed, using mock applications for tests',
            agentsResult.errorText,
          );
          const mockApps = getE2EMockApplications();
          this.agents.length = 0;
          this.models.length = 0;
          mockApps.forEach((app) => {
            this.agents.push(app);
            app.models?.forEach((m) => this.models.push(m));
          });
          return apiOk(true);
        }
        log.error('[ModelRepository] Failed to refresh models from Moku:', agentsResult.errorText);
        return apiFail(agentsResult.errorCode, agentsResult.errorText);
      }

      const agents = agentsResult.data;
      if (agents.length === 0 && isE2ETestMode()) {
        log.warn('[ModelRepository] E2E mode: API returned 0 agents, using mock applications');
        const mockApps = getE2EMockApplications();
        mockApps.forEach((app) => {
          this.agents.push(app);
          app.models?.forEach((m) => this.models.push(m));
        });
        return apiOk(true);
      }
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

      return apiOk(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('[ModelRepository] Failed to refresh models from Moku:', error);
      return apiFail(-1, message);
    } finally {
      this.isRefreshing = false;
    }
  }

  public async listAllModels(): Promise<ApiResponse<ModelDetails[]>> {
    // Return cached models if already loaded
    if (this.models.length > 0) {
      return apiOk([...this.models]);
    }

    // Fetch applications from Moku if cache is empty
    const refreshResult = await this.refreshModels();
    if (!refreshResult.success) {
      return apiFail(refreshResult.errorCode, refreshResult.errorText);
    }

    return apiOk([...this.models]);
  }

  public async listAllApplications(
    reloadFromApi: boolean = false,
  ): Promise<ApiResponse<ApplicationSummary[]>> {
    // Clear cache if a forced reload is requested
    if (reloadFromApi) {
      this.agents.length = 0;
      this.models.length = 0;
    }

    // Return cached applications if already loaded
    if (this.agents.length > 0) {
      return apiOk(
        this.agents.map((app) => ({
          ...app,
          models: app.models ? [...app.models] : [],
        })),
      );
    }

    // Fetch applications from Moku if cache is empty
    const refreshResult = await this.refreshModels();
    if (!refreshResult.success) {
      return apiFail(refreshResult.errorCode, refreshResult.errorText);
    }

    return apiOk(
      this.agents.map((app) => ({
        ...app,
        models: app.models ? [...app.models] : [],
      })),
    );
  }

  public async getAgentById(agentId: string): Promise<ApiResponse<ApplicationSummary>> {
    // Ensure cache is populated
    if (this.agents.length === 0) {
      const refreshResult = await this.refreshModels();
      if (!refreshResult.success) {
        return apiFail(refreshResult.errorCode, refreshResult.errorText);
      }
    }

    // Find application by ID or slug
    const agent = this.agents.find((a) => a.id === agentId);

    if (!agent) {
      log.warn(`[ModelRepository] Agent application not found: ${agentId}`);
      return apiFail(404, 'Agent not found');
    }
    return apiOk(agent);
  }

  /**
   * Get models for a specific application by application ID
   */
  public async getModelsForApplication(
    applicationId: string,
  ): Promise<ApiResponse<ModelDetails[]>> {
    // Ensure cache is populated
    if (this.agents.length === 0) {
      const refreshResult = await this.refreshModels();
      if (!refreshResult.success) {
        return apiFail(refreshResult.errorCode, refreshResult.errorText);
      }
    }

    // Find application by ID or slug
    const app = this.agents.find((a) => a.id === applicationId || a.slug === applicationId);
    if (!app) {
      log.warn(`[ModelRepository] Application not found: ${applicationId}`);
      return apiFail(404, `Application not found: ${applicationId}`);
    }

    // Return deep copy to prevent modifications to cached data
    return apiOk(app.models ? [...app.models] : []);
  }
}

// Singleton instance
export const modelRepository = new ModelRepository();
