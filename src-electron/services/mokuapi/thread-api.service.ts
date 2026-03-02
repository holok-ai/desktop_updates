/**
 * Thread API Service
 * Handles authenticated API calls to Moku backend for thread and message operations
 */

import log from 'electron-log';
import { apiOk, apiFail, type ApiResponse } from '../../types/api-response.js';
import type {
  ThreadDTO,
  MessageDTO,
  RequestOptionsDTO,
  CreateThreadRequest,
  UpdateThreadRequest,
  PagedResponse,
  ThreadFilters,
  MessageFilters,
} from './thread.types.js';

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
 * Service for making authenticated thread/message API calls to Moku backend.
 * Follows the same patterns as MokuService for authentication and error handling.
 */
class ThreadApiService {
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
      log.error('[ThreadApiService] Failed to get access token:', error);
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
      log.warn('[ThreadApiService] Failed to get Moku API URL, using default:', error);
      return 'https://api.holok.ai';
    }
  }

  // ============================================================================
  // Thread Operations
  // ============================================================================

  /**
   * List threads with optional filters and pagination.
   *
   * @param filters - Optional filters (type, projectId, page, size, sort)
   * @returns Paginated response with threads
   * @throws Error if not authenticated or request fails
   */
  async getThreads(filters?: ThreadFilters): Promise<ApiResponse<PagedResponse<ThreadDTO>>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const params = new URLSearchParams();

      if (filters?.type) params.append('type', filters.type);
      if (filters?.projectId) params.append('projectId', filters.projectId);
      if (filters?.page !== undefined) params.append('page', filters.page.toString());
      if (filters?.size !== undefined) params.append('size', filters.size.toString());
      if (filters?.sort) params.append('sort', filters.sort);

      const url = `${mokuApiUrl}/api/threads${params.toString() ? '?' + params.toString() : ''}`;

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

      const data = (await response.json()) as PagedResponse<ThreadDTO>;
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('[ThreadApiService] getThreads exception', message);
      return apiFail(-1, message);
    }
  }

  /**
   * Get a single thread by ID.
   *
   * @param threadId - Thread ID
   * @returns Thread data
   * @throws Error if not authenticated, not found, or request fails
   */
  async getThread(threadId: string): Promise<ApiResponse<ThreadDTO>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const url = `${mokuApiUrl}/api/threads/${threadId}`;

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

      const data = (await response.json()) as ThreadDTO;
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('[ThreadApiService] getThread exception', message);
      return apiFail(-1, message);
    }
  }

  /**
   * Create a new thread.
   *
   * @param request - Thread creation request
   * @returns Created thread data
   * @throws Error if not authenticated or request fails
   */
  async createThread(request: CreateThreadRequest): Promise<ApiResponse<ThreadDTO>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const url = `${mokuApiUrl}/api/threads`;

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

      const data = (await response.json()) as ThreadDTO;
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('[ThreadApiService] createThread exception', message);
      return apiFail(-1, message);
    }
  }

  /**
   * Update an existing thread.
   *
   * @param threadId - Thread ID
   * @param request - Thread update request
   * @returns Updated thread data
   * @throws Error if not authenticated, not found, or request fails
   */
  async updateThread(
    threadId: string,
    request: UpdateThreadRequest,
  ): Promise<ApiResponse<ThreadDTO>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const url = `${mokuApiUrl}/api/threads/${threadId}`;

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

      const data = (await response.json()) as ThreadDTO;
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('[ThreadApiService] updateThread exception', message);
      return apiFail(-1, message);
    }
  }

  /**
   * Delete a thread (soft delete - sets status to 'deleted').
   *
   * @param threadId - Thread ID
   * @throws Error if not authenticated, not found, or request fails
   */
  async deleteThread(threadId: string): Promise<ApiResponse<void>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const url = `${mokuApiUrl}/api/threads/${threadId}`;

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
      log.error('[ThreadApiService] deleteThread exception', message);
      return apiFail(-1, message);
    }
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  /**
   * List messages for a thread with optional pagination.
   *
   * @param threadId - Thread ID
   * @param filters - Optional filters (role, page, size, sort)
   * @returns Paginated response with messages
   * @throws Error if not authenticated or request fails
   */
  async getMessages(
    threadId: string,
    filters?: MessageFilters,
  ): Promise<ApiResponse<PagedResponse<MessageDTO>>> {
    log.info('[ThreadApiService.getMessages] Start', {
      threadId,
      filters,
      stack: new Error().stack,
    });
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const params = new URLSearchParams();

      if (filters?.role) params.append('role', filters.role);
      if (filters?.page !== undefined) params.append('page', filters.page.toString());
      if (filters?.size !== undefined) params.append('size', filters.size.toString());
      if (filters?.sort) params.append('sort', filters.sort);

      const url = `${mokuApiUrl}/api/threads/${threadId}/messages${params.toString() ? '?' + params.toString() : ''}`;
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

      const data = (await response.json()) as PagedResponse<MessageDTO>;
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('[ThreadApiService] getMessages exception', message);
      return apiFail(-1, message);
    }
  }

  // Update just the branch ID
  async updateRequestBranch(
    threadId: string,
    messageId: string,
    branchId: string,
  ): Promise<ApiResponse<MessageDTO>> {
    log.info('[ThreadApiService] updateRequestBranch called', { threadId, messageId, branchId });

    if (!branchId) {
      log.warn('[ThreadApiService] updateRequestBranch: no branchId provided');
      return apiFail(400, 'Invalid parameters. No branch id provided.');
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      log.warn('[ThreadApiService] updateRequestBranch: not authenticated');
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const url = `${mokuApiUrl}/api/threads/${threadId}/messages/${messageId}`;
      log.info('[ThreadApiService] updateRequestBranch PATCH', url, { branch_id: branchId });
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ branch_id: branchId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error('[ThreadApiService] updateRequestBranch failed', response.status, errorText);
        return apiFail(response.status, errorText || `HTTP error ${response.status}`);
      }

      const data = (await response.json()) as MessageDTO;
      log.info('[ThreadApiService] updateRequestBranch success', { messageId: data.id });
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('[ThreadApiService] updateRequestBranch exception', message);
      return apiFail(-1, message);
    }
  }

  // Update just the desktop options
  async updateRequestDesktopOptions(
    threadId: string,
    messageId: string,
    desktopOptions: RequestOptionsDTO,
  ): Promise<ApiResponse<MessageDTO>> {
    log.info('[ThreadApiService] updateRequestDesktopOptions called', {
      threadId,
      messageId,
      desktopOptions,
    });

    if (!desktopOptions) {
      log.warn('[ThreadApiService] updateRequestDesktopOptions: no desktopOptions provided');
      return apiFail(400, 'Invalid parameters. Desktop options field not provided.');
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      log.warn('[ThreadApiService] updateRequestDesktopOptions: not authenticated');
      return apiFail(401, 'Not authenticated. Please log in.');
    }

    try {
      const mokuApiUrl = this.getMokuApiUrl();
      const url = `${mokuApiUrl}/api/threads/${threadId}/messages/${messageId}`;
      log.info('[ThreadApiService] updateRequestDesktopOptions PATCH', url, desktopOptions);
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ desktop_options: desktopOptions }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error(
          '[ThreadApiService] updateRequestDesktopOptions failed',
          response.status,
          errorText,
        );
        return apiFail(response.status, errorText || `HTTP error ${response.status}`);
      }

      const data = (await response.json()) as MessageDTO;
      log.info('[ThreadApiService] updateRequestDesktopOptions success', { messageId: data.id });
      return apiOk(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('[ThreadApiService] updateRequestDesktopOptions exception', message);
      return apiFail(-1, message);
    }
  }
}
/**
 * Singleton instance of ThreadApiService.
 * Import this in other modules to make thread/message API calls.
 *
 * @example
 * import { threadApiService } from './thread-api.service.js';
 * const threads = await threadApiService.getThreads({ type: 'personal' });
 */
export const threadApiService = new ThreadApiService();
