/**
 * Thread and Message API Type Definitions
 * These types match the Moku API backend DTOs for thread operations
 */

/**
 * Thread DTO from Moku API
 */
export interface ThreadDTO {
  id: string;
  title: string;
  type: 'personal' | 'project';
  ownerId: string;
  projectId: string | null;
  createdUserId: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: string; // ISO-8601 timestamp
  updatedAt: string; // ISO-8601 timestamp
}

/**
 * Message DTO from Moku API
 */
export interface MessageDTO {
  id: string;
  threadId: string;
  parentMessageId: string | null;
  branchIndex: number; // 0-9
  branchType?: string;
  isClosed?: boolean;
  model?: string;
  provider?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  requestId?: string;
  clientMessageId?: string;
  createdUserId: string;
  createdAt: string; // ISO-8601 timestamp
  updatedAt: string; // ISO-8601 timestamp
}

/**
 * Request body for creating a new thread
 */
export interface CreateThreadRequest {
  title: string;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Request body for updating a thread
 */
export interface UpdateThreadRequest {
  title?: string;
  status?: 'active' | 'archived' | 'deleted';
  metadata?: Record<string, unknown>;
}

/**
 * Request body for creating a new message
 */
export interface CreateMessageRequest {
  role: 'user' | 'assistant' | 'system';
  content: string;
  parentMessageId?: string | null;
  branchIndex?: number;
  branchType?: string;
  model?: string;
  provider?: string;
  clientMessageId?: string;
  attachments?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Request body for updating message metadata
 */
export interface UpdateMessageRequest {
  metadata: Record<string, unknown>;
}

/**
 * Paginated response wrapper from Moku API
 */
export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Query filters for listing threads
 */
export interface ThreadFilters {
  type?: 'personal' | 'project';
  projectId?: string;
  page?: number;
  size?: number;
  sort?: string;
}

/**
 * Query options for listing messages
 */
export interface MessageFilters {
  role?: 'user' | 'assistant' | 'system';
  page?: number;
  size?: number;
  sort?: string;
}
