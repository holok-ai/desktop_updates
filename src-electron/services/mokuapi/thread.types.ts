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
  metadata?: Record<string, unknown>; // Custom metadata including model configuration
  currentBranchId: string; // Current active branch (e.g., "1.0", "1.1")
}

/**
 * Message DTO from Moku API
 */
export interface MessageDTO {
  id: string;
  threadId: string;
  branchId: string; // Hierarchical branch ID (e.g., "1.0", "1.1", "1.1.1")
  isClosed?: boolean;
  model?: string;
  provider?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  requestId?: string;
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
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Request body for creating a new message
 */
export interface CreateMessageRequest {
  role: 'user' | 'assistant' | 'system';
  content: string;
  branchId: string; // Hierarchical branch ID (e.g., "1.0", "1.1", "1.1.1")
  model?: string;
  provider?: string;
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
