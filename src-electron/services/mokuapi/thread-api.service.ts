/**
 * Thread API Service
 * Handles authenticated API calls to Moku backend for thread and message operations
 */

import log from 'electron-log';
import type {
  ThreadDTO,
  MessageDTO,
  CreateThreadRequest,
  UpdateThreadRequest,
  CreateMessageRequest,
  UpdateMessageRequest,
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
  async getThreads(filters?: ThreadFilters): Promise<PagedResponse<ThreadDTO>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please log in.');
    }

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
      log.error('[ThreadApiService] Get threads failed:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      throw new Error(`Failed to get threads: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as PagedResponse<ThreadDTO>;
    log.info('[ThreadApiService] Fetched threads with filters:', JSON.stringify(filters), `Found ${data.content.length} threads`);
    return data;
  }

  /**
   * Get a single thread by ID.
   *
   * @param threadId - Thread ID
   * @returns Thread data
   * @throws Error if not authenticated, not found, or request fails
   */
  async getThread(threadId: string): Promise<ThreadDTO> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please log in.');
    }

    const mokuApiUrl = this.getMokuApiUrl();
    const url = `${mokuApiUrl}/api/threads/${threadId}`;

    log.info('[ThreadApiService] Fetching thread:', threadId);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('[ThreadApiService] Get thread failed:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      if (response.status === 404) {
        throw new Error(`Thread not found: ${threadId}`);
      }
      throw new Error(`Failed to get thread: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as ThreadDTO;
    log.info('[ThreadApiService] Successfully fetched thread:', threadId);
    return data;
  }

  /**
   * Create a new thread.
   *
   * @param request - Thread creation request
   * @returns Created thread data
   * @throws Error if not authenticated or request fails
   */
  async createThread(request: CreateThreadRequest): Promise<ThreadDTO> {
    log.info('[ThreadApiService] createThread called with:', request);

    const accessToken = await this.getAccessToken();
    log.info(
      '[ThreadApiService] Access token retrieved:',
      accessToken ? `YES (${accessToken.substring(0, 20)}...)` : 'NO',
    );

    if (!accessToken) {
      throw new Error('Not authenticated. Please log in.');
    }

    const mokuApiUrl = this.getMokuApiUrl();
    log.info('[ThreadApiService] Moku API URL:', mokuApiUrl);

    const url = `${mokuApiUrl}/api/threads`;
    log.info('[ThreadApiService] Full URL:', url);

    log.info('[ThreadApiService] Creating thread:', request.title);
    log.info('[ThreadApiService] Request body:', JSON.stringify(request));

    let response;
    try {
      log.info('[ThreadApiService] About to call fetch...');
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      log.info('[ThreadApiService] Fetch completed, status:', response.status);
    } catch (fetchError) {
      log.error('[ThreadApiService] Fetch error:', fetchError);
      log.error('[ThreadApiService] Fetch error details:', {
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        name: fetchError instanceof Error ? fetchError.name : 'unknown',
        stack: fetchError instanceof Error ? fetchError.stack : 'no stack',
      });
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text();
      log.error('[ThreadApiService] Create thread failed:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      throw new Error(`Failed to create thread: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as ThreadDTO;
    log.info('[ThreadApiService] Successfully created thread:', data.id);
    return data;
  }

  /**
   * Update an existing thread.
   *
   * @param threadId - Thread ID
   * @param request - Thread update request
   * @returns Updated thread data
   * @throws Error if not authenticated, not found, or request fails
   */
  async updateThread(threadId: string, request: UpdateThreadRequest): Promise<ThreadDTO> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please log in.');
    }

    const mokuApiUrl = this.getMokuApiUrl();
    const url = `${mokuApiUrl}/api/threads/${threadId}`;

    log.info('[ThreadApiService] Updating thread:', threadId);

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
      log.error('[ThreadApiService] Update thread failed:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      if (response.status === 404) {
        throw new Error(`Thread not found: ${threadId}`);
      }
      throw new Error(`Failed to update thread: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as ThreadDTO;
    log.info('[ThreadApiService] Successfully updated thread:', threadId);
    return data;
  }

  /**
   * Delete a thread (soft delete - sets status to 'deleted').
   *
   * @param threadId - Thread ID
   * @throws Error if not authenticated, not found, or request fails
   */
  async deleteThread(threadId: string): Promise<void> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please log in.');
    }

    const mokuApiUrl = this.getMokuApiUrl();
    const url = `${mokuApiUrl}/api/threads/${threadId}`;

    log.info('[ThreadApiService] Deleting thread:', threadId);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('[ThreadApiService] Delete thread failed:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      if (response.status === 404) {
        throw new Error(`Thread not found: ${threadId}`);
      }
      throw new Error(`Failed to delete thread: ${response.status} ${errorText}`);
    }

    log.info('[ThreadApiService] Successfully deleted thread:', threadId);
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
  ): Promise<PagedResponse<MessageDTO>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please log in.');
    }

    const mokuApiUrl = this.getMokuApiUrl();
    const params = new URLSearchParams();

    if (filters?.role) params.append('role', filters.role);
    if (filters?.page !== undefined) params.append('page', filters.page.toString());
    if (filters?.size !== undefined) params.append('size', filters.size.toString());
    if (filters?.sort) params.append('sort', filters.sort);

    const url = `${mokuApiUrl}/api/threads/${threadId}/messages${params.toString() ? '?' + params.toString() : ''}`;

    log.info('[ThreadApiService] Fetching messages for thread:', threadId);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('[ThreadApiService] Get messages failed:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      if (response.status === 404) {
        throw new Error(`Thread not found: ${threadId}`);
      }
      throw new Error(`Failed to get messages: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as PagedResponse<MessageDTO>;
    //log.info('[ThreadApiService] Successfully fetched messages:', data.content);
    return data;
  }

  /**
   * Get a single message by ID.
   *
   * @param messageId - Message ID
   * @returns Message data
   * @throws Error if not authenticated, not found, or request fails
   */
  async getMessage(messageId: string): Promise<MessageDTO> {
    log.info('[ThreadApiService] getMessage called with:', messageId, 'mokuApiUrl:', this.getMokuApiUrl());

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please log in.');
    }

    const mokuApiUrl = this.getMokuApiUrl();
    const url = `${mokuApiUrl}/api/messages/${messageId}`;

    log.info('[ThreadApiService] Fetching message:', messageId);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('[ThreadApiService] Get message failed:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      if (response.status === 404) {
        throw new Error(`Message not found: ${messageId}`);
      }
      throw new Error(`Failed to get message: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as MessageDTO;
    log.info('[ThreadApiService] Successfully fetched message:', messageId);
    return data;
  }

  /**
   * Create a new message in a thread.
   *
   * @param threadId - Thread ID
   * @param request - Message creation request
   * @returns Created message data
   * @throws Error if not authenticated or request fails
   */
  async createMessage(threadId: string, request: CreateMessageRequest): Promise<MessageDTO> {
    log.info('[ThreadApiService] createMessage called with:', request, 'mokuApiUrl:', this.getMokuApiUrl());

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please log in.');
    }

    const mokuApiUrl = this.getMokuApiUrl();
    const url = `${mokuApiUrl}/api/threads/${threadId}/messages`;

    log.info('[ThreadApiService] Creating message in thread:', threadId);

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
      log.error('[ThreadApiService] Create message failed:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      if (response.status === 400) {
        // Enhanced error message for validation failures
        throw new Error(`Invalid message request: ${errorText}`);
      }
      if (response.status === 404) {
        throw new Error(`Thread not found: ${threadId}`);
      }
      throw new Error(`Failed to create message: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as MessageDTO;

    log.info('[ThreadApiService] Successfully created message:', data.id);
    return data;
  }

  /**
   * Update message metadata.
   *
   * @param messageId - Message ID
   * @param request - Message update request (metadata only)
   * @returns Updated message data
   * @throws Error if not authenticated, not found, or request fails
   */
  async updateMessage(messageId: string, request: UpdateMessageRequest): Promise<MessageDTO> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please log in.');
    }

    const mokuApiUrl = this.getMokuApiUrl();
    const url = `${mokuApiUrl}/api/messages/${messageId}`;

    log.info('[ThreadApiService] Updating message:', messageId);

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
      log.error('[ThreadApiService] Update message failed:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      if (response.status === 404) {
        throw new Error(`Message not found: ${messageId}`);
      }
      throw new Error(`Failed to update message: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as MessageDTO;
    log.info('[ThreadApiService] Successfully updated message:', messageId);
    return data;
  }

  /**
   * Delete a message.
   *
   * @param messageId - Message ID
   * @throws Error if not authenticated, not found, or request fails
   */
  async deleteMessage(messageId: string): Promise<void> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please log in.');
    }

    const mokuApiUrl = this.getMokuApiUrl();
    const url = `${mokuApiUrl}/api/messages/${messageId}`;

    log.info('[ThreadApiService] Deleting message:', messageId);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('[ThreadApiService] Delete message failed:', response.status, errorText);

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      if (response.status === 404) {
        throw new Error(`Message not found: ${messageId}`);
      }
      throw new Error(`Failed to delete message: ${response.status} ${errorText}`);
    }

    log.info('[ThreadApiService] Successfully deleted message:', messageId);
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
