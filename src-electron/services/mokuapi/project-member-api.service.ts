/**
 * Project Member API Service
 * Handles authenticated API calls to Moku backend for project member operations.
 * All methods return ApiResponse<T> instead of throwing.
 */

import { getAuthService } from '../../ipc-handlers/auth-handler.js';
import { getSettingsService } from '../../ipc-handlers/settings-handler.js';
import { mokuFetch } from '../reliability/moku-fetch.js';
import type { AuthService } from '../auth.service.js';
import type { SettingsService } from '../settings.service.js';
import { apiOk, apiFail, type ApiResponse } from '../../types/api-response.js';

// For testing only - allow mock injection
let mockAuthService: AuthService | null = null;
let mockSettingsService: SettingsService | null = null;

function getAuthServiceInternal(): AuthService {
  if (mockAuthService) {
    return mockAuthService;
  }
  return getAuthService();
}

function getSettingsServiceInternal(): SettingsService {
  if (mockSettingsService) {
    return mockSettingsService;
  }
  return getSettingsService();
}

/**
 * For testing only - inject mock dependencies
 * @internal
 */
export function __setDependenciesForTesting(auth: AuthService, settings: SettingsService): void {
  mockAuthService = auth;
  mockSettingsService = settings;
}

/**
 * For testing only - clear mock dependencies
 * @internal
 */
export function __clearDependenciesForTesting(): void {
  mockAuthService = null;
  mockSettingsService = null;
}

export interface MemberDTO {
  id: string;
  userId: string;
  organizationId: string;
  userName: string;
  userEmail: string;
  role: string;
  createdAt: string;
}

class ProjectMemberApiService {
  /**
   * Get all members for a project
   */
  public async getProjectMembers(projectId: string): Promise<ApiResponse<MemberDTO[]>> {
    const authService = getAuthServiceInternal();
    const settingsService = getSettingsServiceInternal();

    if (!authService.isAuthenticated()) {
      return apiFail(401, 'User not authenticated');
    }

    try {
      // Await token (will refresh if expired)
      const accessToken = await authService.getAccessToken();
      if (!accessToken) {
        return apiFail(401, 'No access token available');
      }

      const apiUrl = settingsService.getMokuApiUrl();
      const url = new URL(`/api/v1/projects/${projectId}/members`, apiUrl);

      const response = await mokuFetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return apiFail(response.status, `Failed to get project members: ${response.statusText}`);
      }

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return apiFail(
          -1,
          `API returned non-JSON response (${contentType}). Check if endpoint exists.`,
        );
      }

      const data = (await response.json()) as MemberDTO[];
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return apiFail(-1, message);
    }
  }

  /**
   * Add a member to a project
   */
  public async addProjectMember(
    projectId: string,
    userId: string,
    role: string,
  ): Promise<ApiResponse<MemberDTO>> {
    const authService = getAuthServiceInternal();
    const settingsService = getSettingsServiceInternal();

    if (!authService.isAuthenticated()) {
      return apiFail(401, 'User not authenticated');
    }

    try {
      // Await token (will refresh if expired)
      const accessToken = await authService.getAccessToken();
      if (!accessToken) {
        return apiFail(401, 'No access token available');
      }

      const apiUrl = settingsService.getMokuApiUrl();
      const url = new URL(`/api/v1/projects/${projectId}/members`, apiUrl);

      const response = await mokuFetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId, role }),
      });

      if (!response.ok) {
        return apiFail(response.status, `Failed to add project member: ${response.statusText}`);
      }

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return apiFail(
          -1,
          `API returned non-JSON response (${contentType}). Check if endpoint exists.`,
        );
      }

      const data = (await response.json()) as MemberDTO;
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return apiFail(-1, message);
    }
  }

  /**
   * Remove a member from a project
   */
  public async removeProjectMember(
    projectId: string,
    memberId: string,
  ): Promise<ApiResponse<void>> {
    const authService = getAuthServiceInternal();
    const settingsService = getSettingsServiceInternal();

    if (!authService.isAuthenticated()) {
      return apiFail(401, 'User not authenticated');
    }

    try {
      // Await token (will refresh if expired)
      const accessToken = await authService.getAccessToken();
      if (!accessToken) {
        return apiFail(401, 'No access token available');
      }

      const apiUrl = settingsService.getMokuApiUrl();
      const url = new URL(`/api/v1/projects/${projectId}/members/${memberId}`, apiUrl);

      const response = await mokuFetch(url.toString(), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return apiFail(response.status, `Failed to remove project member: ${response.statusText}`);
      }

      return apiOk(undefined) as ApiResponse<void>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return apiFail(-1, message);
    }
  }
}

// Export singleton instance
export const projectMemberApiService = new ProjectMemberApiService();
