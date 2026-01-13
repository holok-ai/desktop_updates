/**
 * User API Service
 * Handles authenticated API calls to Moku backend for user operations
 */

import log from 'electron-log';
import type { UserSummaryDTO } from './user.types.js';
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

class UserApiService {
    /**
     * Search users in the current user's organization
     * @param searchTerm Optional search term for name/email (null returns all users)
     * @returns Paged response with user summaries
     */
    public async searchUsers(searchTerm?: string | null): Promise<PagedResponse<UserSummaryDTO>> {
        log.info('[UserApiService] Searching users', { searchTerm });

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
        const url = new URL('/api/v1/users/search', apiUrl);

        // Add query parameters
        const params = new URLSearchParams();
        params.append('page', '0');
        params.append('size', '100'); // Get a reasonable batch
        params.append('sort', 'displayName,asc');

        if (searchTerm) {
            params.append('search', searchTerm);
        }

        // Only include active users by default
        params.append('status', 'active');

        url.search = params.toString();

        log.debug('[UserApiService] Fetching users from', url.toString());

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            log.error('[UserApiService] Failed to search users', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
            });
            throw new Error(`Failed to search users: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as PagedResponse<UserSummaryDTO>;
        log.info('[UserApiService] Successfully retrieved users', {
            totalElements: data.totalElements,
            pageSize: data.size,
        });

        return data;
    }
}

// Export singleton instance
export const userApiService = new UserApiService();
