/**
 * Project API Service
 * Handles authenticated API calls to Moku backend for project operations
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

// Import dependencies directly (singleton pattern ensures single instance)
import { getAuthService } from '../../ipc-handlers/auth-handler.js';
import { getSettingsService } from '../../ipc-handlers/settings-handler.js';
import type { AuthService } from '../auth.service.js';
import type { SettingsService } from '../settings.service.js';

// For testing only - allow mock injection
let mockAuthService: AuthService | null = null;
let mockSettingsService: SettingsService | null = null;

function getAuthServiceInternal(): AuthService {
    // If mock injected for testing, use that
    if (mockAuthService) {
        return mockAuthService;
    }
    // Otherwise use real service
    return getAuthService();
}

function getSettingsServiceInternal(): SettingsService {
    // If mock injected for testing, use that
    if (mockSettingsService) {
        return mockSettingsService;
    }
    // Otherwise use real service
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
 * For testing only - reset dependencies
 * @internal
 */
export function __resetDependenciesForTesting(): void {
    mockAuthService = null;
    mockSettingsService = null;
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
     *
     * @param filters - Optional filters (page, size, sort)
     * @returns Paginated response with projects
     * @throws Error if not authenticated or request fails
     */
    async getProjects(filters?: ProjectFilters): Promise<PagedResponse<ProjectDTO>> {
        const accessToken = await this.getAccessToken();
        if (!accessToken) {
            throw new Error('Not authenticated. Please log in.');
        }

        const mokuApiUrl = this.getMokuApiUrl();
        const params = new URLSearchParams();

        if (filters?.page !== undefined) params.append('page', filters.page.toString());
        if (filters?.size !== undefined) params.append('size', filters.size.toString());
        if (filters?.sort) params.append('sort', filters.sort);

        const url = `${mokuApiUrl}/api/v1/projects${params.toString() ? '?' + params.toString() : ''}`;

        log.info('[ProjectApiService] Fetching projects with filters:', filters);

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        console.log({
            accessToken
        })

        if (!response.ok) {
            const errorText = await response.text();
            log.error('[ProjectApiService] Get projects failed:', response.status, errorText);

            if (response.status === 401) {
                throw new Error('Authentication failed. Please log in again.');
            }
            throw new Error(`Failed to get projects: ${response.status} ${errorText}`);
        }

        const data = (await response.json()) as PagedResponse<ProjectDTO>;
        log.info('[ProjectApiService] Successfully fetched projects:', data.content.length, 'items');
        return data;
    }

    /**
     * Get a single project by ID.
     *
     * @param projectId - Project ID
     * @returns Project detail data with user's role
     * @throws Error if not authenticated, not found, or request fails
     */
    async getProject(projectId: string): Promise<ProjectDetailDTO> {
        const accessToken = await this.getAccessToken();
        if (!accessToken) {
            throw new Error('Not authenticated. Please log in.');
        }

        const mokuApiUrl = this.getMokuApiUrl();
        const url = `${mokuApiUrl}/api/v1/projects/${projectId}`;

        log.info('[ProjectApiService] Fetching project:', projectId);

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('[ProjectApiService] Get project failed:', response.status, errorText);

            if (response.status === 401) {
                throw new Error('Authentication failed. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('Access denied. You do not have permission to access this project.');
            }
            if (response.status === 404) {
                throw new Error(`Project not found: ${projectId}`);
            }
            throw new Error(`Failed to get project: ${response.status} ${errorText}`);
        }

        const data = (await response.json()) as ProjectDetailDTO;
        log.info('[ProjectApiService] Successfully fetched project:', projectId);
        return data;
    }

    /**
     * Create a new project.
     * The creator is automatically added as an owner member.
     *
     * @param request - Project creation request
     * @returns Created project detail data
     * @throws Error if not authenticated or request fails
     */
    async createProject(request: ProjectCreateRequest): Promise<ProjectDetailDTO> {
        const accessToken = await this.getAccessToken();
        if (!accessToken) {
            throw new Error('Not authenticated. Please log in.');
        }

        const mokuApiUrl = this.getMokuApiUrl();
        const url = `${mokuApiUrl}/api/v1/projects`;

        log.info('[ProjectApiService] Creating project:', request.name);
        log.info('[ProjectApiService] Request body:', JSON.stringify(request));

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
            log.error('[ProjectApiService] Create project failed:', response.status, errorText);

            if (response.status === 401) {
                throw new Error('Authentication failed. Please log in again.');
            }
            if (response.status === 400) {
                throw new Error(`Invalid project request: ${errorText}`);
            }
            throw new Error(`Failed to create project: ${response.status} ${errorText}`);
        }

        const data = (await response.json()) as ProjectDetailDTO;
        log.info('[ProjectApiService] Successfully created project:', data.id);
        return data;
    }

    /**
     * Update an existing project.
     * Requires owner role.
     *
     * @param projectId - Project ID
     * @param request - Project update request
     * @returns Updated project detail data
     * @throws Error if not authenticated, not found, insufficient permissions, or request fails
     */
    async updateProject(projectId: string, request: ProjectUpdateRequest): Promise<ProjectDetailDTO> {
        const accessToken = await this.getAccessToken();
        if (!accessToken) {
            throw new Error('Not authenticated. Please log in.');
        }

        const mokuApiUrl = this.getMokuApiUrl();
        const url = `${mokuApiUrl}/api/v1/projects/${projectId}`;

        log.info('[ProjectApiService] Updating project:', projectId);

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
            log.error('[ProjectApiService] Update project failed:', response.status, errorText);

            if (response.status === 401) {
                throw new Error('Authentication failed. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('Access denied. Owner role required to update this project.');
            }
            if (response.status === 404) {
                throw new Error(`Project not found: ${projectId}`);
            }
            if (response.status === 400) {
                throw new Error(`Invalid update request: ${errorText}`);
            }
            throw new Error(`Failed to update project: ${response.status} ${errorText}`);
        }

        const data = (await response.json()) as ProjectDetailDTO;
        log.info('[ProjectApiService] Successfully updated project:', projectId);
        return data;
    }

    /**
     * Delete a project (soft delete).
     * Requires owner role.
     *
     * @param projectId - Project ID
     * @throws Error if not authenticated, not found, insufficient permissions, or request fails
     */
    async deleteProject(projectId: string): Promise<void> {
        const accessToken = await this.getAccessToken();
        if (!accessToken) {
            throw new Error('Not authenticated. Please log in.');
        }

        const mokuApiUrl = this.getMokuApiUrl();
        const url = `${mokuApiUrl}/api/v1/projects/${projectId}`;

        log.info('[ProjectApiService] Deleting project:', projectId);

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('[ProjectApiService] Delete project failed:', response.status, errorText);

            if (response.status === 401) {
                throw new Error('Authentication failed. Please log in again.');
            }
            if (response.status === 403) {
                throw new Error('Access denied. Owner role required to delete this project.');
            }
            if (response.status === 404) {
                throw new Error(`Project not found: ${projectId}`);
            }
            throw new Error(`Failed to delete project: ${response.status} ${errorText}`);
        }

        log.info('[ProjectApiService] Successfully deleted project:', projectId);
    }

    /**
     * Get project updates since a specific timestamp.
     *
     * @param projectId - Project ID
     * @param since - ISO-8601 timestamp to check for updates
     * @returns Update counts for threads, members, and workflows
     * @throws Error if not authenticated, not found, or request fails
     */
    async getUpdates(projectId: string, since: string): Promise<ProjectUpdatesResponse> {
        const accessToken = await this.getAccessToken();
        if (!accessToken) {
            throw new Error('Not authenticated. Please log in.');
        }

        const mokuApiUrl = this.getMokuApiUrl();
        const url = `${mokuApiUrl}/api/v1/projects/${projectId}/updates?since=${encodeURIComponent(since)}`;

        log.info('[ProjectApiService] Fetching updates for project:', projectId, 'since:', since);

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('[ProjectApiService] Get updates failed:', response.status, errorText);

            if (response.status === 401) {
                throw new Error('Authentication failed. Please log in again.');
            }
            if (response.status === 404) {
                throw new Error(`Project not found: ${projectId}`);
            }
            throw new Error(`Failed to get project updates: ${response.status} ${errorText}`);
        }

        const data = (await response.json()) as ProjectUpdatesResponse;
        log.info('[ProjectApiService] Successfully fetched updates for project:', projectId);
        return data;
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
