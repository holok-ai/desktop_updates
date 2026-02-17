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
import type { ApplicationSummary, ApplicationDetail } from './application.types.js';
import type { PagedResponse } from './paging.types.js';
import type { AgentListItem, AgentChatConfig } from './agent.types.js';
import type {
  ProjectDTO,
  ProjectDetailDTO,
  ProjectCreateRequest,
  ProjectUpdateRequest,
  ProjectFilters,
  ProjectUpdatesResponse,
} from './project.types.js';
import { projectApiService } from './project-api.service.js';

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
    const mokuApiUrl = this.getMokuApiUrl();

    const refreshUrl = `${mokuApiUrl}/api/auth/token/refresh`;
    log.info(`Calling refresh endpoint at: ${refreshUrl}`);
    const response = await fetch(refreshUrl, {
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

    return { accessToken, expires_in };
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
      } catch (error) {
        log.error('[MokuService] Error fetching applications:', error);
        throw error;
      }
    }

    // Convert arrays to Sets for modelNames, guards, and evaluators
    return allApps.map((app) => ({
      ...app,
      modelNames: new Set(app.modelNames as unknown as string[]),
      guards: app.guards ? new Set(app.guards as unknown as string[]) : undefined,
      evaluators: app.evaluators ? new Set(app.evaluators as unknown as string[]) : undefined,
    }));
  }

  /**
   * Get application detail by ID from Moku API
   * Fetches full application information including models array
   */
  public async getApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
    const mokuApiUrl = this.getMokuApiUrl();
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      log.error('[MokuService] No access token available');
      throw new Error('Not authenticated. Please log in first.');
    }

    try {
      const response = await fetch(`${mokuApiUrl}/api/applications/${applicationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error('[MokuService] Get application detail failed:', response.status, errorText);

        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(`Failed to get application detail: ${response.status}`);
      }

      const data = (await response.json()) as ApplicationDetail;
      return data;
    } catch (error) {
      log.error('[MokuService] Error fetching application detail:', error);
      throw error;
    }
  }

  /**
   * Get agent detail (AgentChatConfig) by ID from Moku API
   * Fetches full agent information including chat configuration with Holo API URL
   */
  public async getAgentDetail(agentId: string): Promise<AgentChatConfig> {
    const mokuApiUrl = this.getMokuApiUrl();
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      log.error('[MokuService] No access token available');
      throw new Error('Not authenticated. Please log in first.');
    }

    try {
      const response = await fetch(`${mokuApiUrl}/api/v1/agents/${agentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error('[MokuService] Get agent detail failed:', response.status, errorText);

        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(`Failed to get agent detail: ${response.status}`);
      }

      const data = (await response.json()) as AgentChatConfig;
      return data;
    } catch (error) {
      log.error('[MokuService] Error fetching agent detail:', error);
      throw error;
    }
  }

  // ============================================================================
  // Project Operations
  // ============================================================================

  /**
   * Get all projects where user is a member with pagination support
   * Fetches all pages and returns a complete list of projects
   */
  public async getAllProjects(): Promise<ProjectDTO[]> {
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      log.error('[MokuService] No access token available');
      throw new Error('Not authenticated. Please log in first.');
    }

    let allProjects: ProjectDTO[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await projectApiService.getProjects({ page, size: 1000 });
        allProjects = allProjects.concat(response.content);
        hasMore = response.hasNext;
        page++;
      } catch (error) {
        log.error('[MokuService] Error fetching projects:', error);
        throw error;
      }
    }

    return allProjects;
  }

  /**
   * Get projects with pagination control
   * Returns paginated response for controlled loading
   */
  public async getProjects(filters?: ProjectFilters): Promise<PagedResponse<ProjectDTO>> {
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      log.error('[MokuService] No access token available');
      throw new Error('Not authenticated. Please log in first.');
    }

    return await projectApiService.getProjects(filters);
  }

  /**
   * Get project detail by ID
   * Fetches full project information including user's role
   */
  public async getProjectDetail(projectId: string): Promise<ProjectDetailDTO> {
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      log.error('[MokuService] No access token available');
      throw new Error('Not authenticated. Please log in first.');
    }

    return await projectApiService.getProject(projectId);
  }

  /**
   * Create a new project
   * Creator is automatically added as owner member
   */
  public async createProject(request: ProjectCreateRequest): Promise<ProjectDetailDTO> {
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      log.error('[MokuService] No access token available');
      throw new Error('Not authenticated. Please log in first.');
    }

    return await projectApiService.createProject(request);
  }

  /**
   * Update an existing project
   * Requires owner role
   */
  public async updateProject(
    projectId: string,
    request: ProjectUpdateRequest,
  ): Promise<ProjectDetailDTO> {
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      log.error('[MokuService] No access token available');
      throw new Error('Not authenticated. Please log in first.');
    }

    return await projectApiService.updateProject(projectId, request);
  }

  /**
   * Delete a project (soft delete)
   * Requires owner role
   */
  public async deleteProject(projectId: string): Promise<void> {
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      log.error('[MokuService] No access token available');
      throw new Error('Not authenticated. Please log in first.');
    }

    return await projectApiService.deleteProject(projectId);
  }

  /**
   * Get project updates since a specific timestamp
   * Returns counts of updated threads, members, and workflows
   */
  public async getProjectUpdates(
    projectId: string,
    since: string,
  ): Promise<ProjectUpdatesResponse> {
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      log.error('[MokuService] No access token available');
      throw new Error('Not authenticated. Please log in first.');
    }

    return await projectApiService.getUpdates(projectId, since);
  }
}

// Export a singleton instance for simple usage in the rest of the app
export const mokuService = new MokuService();

export default MokuService;
