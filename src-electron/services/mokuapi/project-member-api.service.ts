/**
 * Project Member API Service
 * Handles authenticated API calls to Moku backend for project member operations
 */

import log from 'electron-log';
import { getAuthService } from '../../ipc-handlers/auth-handler.js';
import { getSettingsService } from '../../ipc-handlers/settings-handler.js';
import type { AuthService } from '../auth.service.js';
import type { SettingsService } from '../settings.service.js';

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
     * @param projectId The project ID
     * @returns Array of member DTOs
     */
    public async getProjectMembers(projectId: string): Promise<MemberDTO[]> {
        log.info('[ProjectMemberApiService] Getting members for project', { projectId });

        const authService = getAuthServiceInternal();
        const settingsService = getSettingsServiceInternal();

        if (!authService.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        // Await token (will refresh if expired)
        const accessToken = await authService.getAccessToken();
        if (!accessToken) {
            throw new Error('No access token available');
        }

        const apiUrl = settingsService.getMokuApiUrl();
        const url = new URL(`/api/v1/projects/${projectId}/members`, apiUrl);

        log.debug('[ProjectMemberApiService] Fetching members from', url.toString());

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('[ProjectMemberApiService] Failed to get project members', {
                url: url.toString(),
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get('content-type'),
                error: errorText.substring(0, 500), // First 500 chars
            });
            throw new Error(`Failed to get project members: ${response.status} ${response.statusText}`);
        }

        // Check if response is actually JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const errorText = await response.text();
            log.error('[ProjectMemberApiService] Response is not JSON', {
                url: url.toString(),
                status: response.status,
                contentType: contentType,
                responseStart: errorText.substring(0, 500),
            });
            throw new Error(`API returned non-JSON response (${contentType}). Check if endpoint exists.`);
        }

        const data = (await response.json()) as MemberDTO[];
        log.info('[ProjectMemberApiService] Successfully retrieved members', {
            projectId,
            memberCount: data.length,
        });

        return data;
    }

    /**
     * Add a member to a project
     * @param projectId The project ID
     * @param userId The user's UUID
     * @param role The role to assign ('viewer' or 'editor')
     * @returns The created member DTO
     */
    public async addProjectMember(projectId: string, userId: string, role: string): Promise<MemberDTO> {
        log.info('[ProjectMemberApiService] Adding member to project', { projectId, userId, role });

        const authService = getAuthServiceInternal();
        const settingsService = getSettingsServiceInternal();

        if (!authService.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        // Await token (will refresh if expired)
        const accessToken = await authService.getAccessToken();
        if (!accessToken) {
            throw new Error('No access token available');
        }

        const apiUrl = settingsService.getMokuApiUrl();
        const url = new URL(`/api/v1/projects/${projectId}/members`, apiUrl);

        log.debug('[ProjectMemberApiService] Adding member to', url.toString());

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ userId, role }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('[ProjectMemberApiService] Failed to add project member', {
                url: url.toString(),
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get('content-type'),
                error: errorText.substring(0, 500),
            });
            throw new Error(`Failed to add project member: ${response.status} ${response.statusText}`);
        }

        // Check if response is actually JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const errorText = await response.text();
            log.error('[ProjectMemberApiService] Response is not JSON', {
                url: url.toString(),
                status: response.status,
                contentType: contentType,
                responseStart: errorText.substring(0, 500),
            });
            throw new Error(`API returned non-JSON response (${contentType}). Check if endpoint exists.`);
        }

        const data = (await response.json()) as MemberDTO;
        log.info('[ProjectMemberApiService] Successfully added member', {
            projectId,
            userId,
            memberId: data.id,
        });

        return data;
    }

    /**
     * Remove a member from a project
     * @param projectId The project ID
     * @param memberId The member ID to remove
     */
    public async removeProjectMember(projectId: string, memberId: string): Promise<void> {
        log.info('[ProjectMemberApiService] Removing member from project', { projectId, memberId });

        const authService = getAuthServiceInternal();
        const settingsService = getSettingsServiceInternal();

        if (!authService.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        // Await token (will refresh if expired)
        const accessToken = await authService.getAccessToken();
        if (!accessToken) {
            throw new Error('No access token available');
        }

        const apiUrl = settingsService.getMokuApiUrl();
        const url = new URL(`/api/v1/projects/${projectId}/members/${memberId}`, apiUrl);

        log.debug('[ProjectMemberApiService] Removing member from', url.toString());

        const response = await fetch(url.toString(), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('[ProjectMemberApiService] Failed to remove project member', {
                url: url.toString(),
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get('content-type'),
                error: errorText.substring(0, 500),
            });
            throw new Error(`Failed to remove project member: ${response.status} ${response.statusText}`);
        }

        log.info('[ProjectMemberApiService] Successfully removed member', {
            projectId,
            memberId,
        });
    }
}

// Export singleton instance
export const projectMemberApiService = new ProjectMemberApiService();
