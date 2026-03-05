/**
 * Project API Service
 * Handles authenticated API calls to Moku backend for project operations.
 * All methods return ApiResponse<T> instead of throwing.
 */

import log from 'electron-log';
import type {
  ProjectDTO,
  ProjectDetailDTO,
  ProjectCreateRequest,
  ProjectUpdateRequest,
  ProjectFilters,
  ProjectUpdatesResponse,
} from './project.types.js';
import type { PagedResponse } from './paging.types.js';
import { apiOk, apiFail, type ApiResponse } from '../../types/api-response.js';

// Import dependencies directly (singleton pattern ensures single instance)
import { getAuthService } from '../../ipc-handlers/auth-handler.js';
import { getSettingsService } from '../../ipc-handlers/settings-handler.js';
import type { AuthService } from '../auth.service.js';
import type { SettingsService } from '../settings.service.js';

function getAuthServiceInternal(): AuthService {
  // Otherwise use real service
  return getAuthService();
}

function getSettingsServiceInternal(): SettingsService {
  // Otherwise use real service
  return getSettingsService();
}

/**
 * Service for making authenticated project API calls to Moku backend.
 * Follows the same patterns as ThreadApiService for authentication and error handling.
 */
class ProjectApiService {
  /**
   * Get access token from AuthService.
   * Returns null if user is not authenticated.
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      const authSvc = getAuthServiceInternal();
      const token = await authSvc.getAccessToken();
      return token;
    } catch (error) {
      log.error('[ProjectApiService] Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Get Moku API base URL from SettingsService.
   * Defaults to 'https://api.holok.ai' if not configured.
   */
  private getMokuApiUrl(): string {
    try {
      return getSettingsServiceInternal().getMokuApiUrl() || 'https://api.holok.ai';
    } catch (error) {
      log.warn('[ProjectApiService] Failed to get Moku API URL, using default:', error);
      return 'https://api.holok.ai';
    }
  }

  /**
   * List projects where user is a member with optional pagination.
   */
  async getProjects(filters?: ProjectFilters): Promise<ApiResponse<PagedResponse<ProjectDTO>>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const params = new URLSearchParams();

      if (filters?.page !== undefined) params.append('page', filters.page.toString());
      if (filters?.size !== undefined) params.append('size', filters.size.toString());
      if (filters?.sort) params.append('sort', filters.sort);

      const url = `${mokuApiUrl}/api/v1/projects${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return apiFail(response.status, errorText || `HTTP error ${response.status}`);
      }

      const data = (await response.json()) as PagedResponse<ProjectDTO>;
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return apiFail(-1, message);
    }
  }

  /**
   * Get a single project by ID.
   */
  async getProject(projectId: string): Promise<ApiResponse<ProjectDetailDTO>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const url = `${mokuApiUrl}/api/v1/projects/${projectId}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return apiFail(response.status, errorText || `HTTP error ${response.status}`);
      }

      const data = (await response.json()) as ProjectDetailDTO;
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return apiFail(-1, message);
    }
  }

  /**
   * Create a new project.
   * The creator is automatically added as an owner member.
   */
  async createProject(request: ProjectCreateRequest): Promise<ApiResponse<ProjectDetailDTO>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const url = `${mokuApiUrl}/api/v1/projects`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return apiFail(response.status, errorText || `HTTP error ${response.status}`);
      }

      const data = (await response.json()) as ProjectDetailDTO;
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return apiFail(-1, message);
    }
  }

  /**
   * Update an existing project.
   * Requires owner role.
   */
  async updateProject(
    projectId: string,
    request: ProjectUpdateRequest,
  ): Promise<ApiResponse<ProjectDetailDTO>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const url = `${mokuApiUrl}/api/v1/projects/${projectId}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return apiFail(response.status, errorText || `HTTP error ${response.status}`);
      }

      const data = (await response.json()) as ProjectDetailDTO;
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return apiFail(-1, message);
    }
  }

  /**
   * Delete a project (soft delete).
   * Requires owner role.
   */
  async deleteProject(projectId: string): Promise<ApiResponse<void>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const url = `${mokuApiUrl}/api/v1/projects/${projectId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return apiFail(response.status, errorText || `HTTP error ${response.status}`);
      }

      return apiOk(undefined) as ApiResponse<void>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return apiFail(-1, message);
    }
  }

  /**
   * Get project updates since a specific timestamp.
   */
  async getUpdates(projectId: string, since: string): Promise<ApiResponse<ProjectUpdatesResponse>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const url = `${mokuApiUrl}/api/v1/projects/${projectId}/updates?since=${encodeURIComponent(since)}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return apiFail(response.status, errorText || `HTTP error ${response.status}`);
      }

      const data = (await response.json()) as ProjectUpdatesResponse;
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return apiFail(-1, message);
    }
  }
}

/**
 * Singleton instance of ProjectApiService.
 * Import this in other modules to make project API calls.
 *
 * @example
 * import { projectApiService } from './project-api.service.js';
 * const projects = await projectApiService.getProjects({ size: 20 });
 */
export const projectApiService = new ProjectApiService();
