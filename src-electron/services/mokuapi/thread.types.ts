import type { ThreadMetadata } from '../../types/thread.types.js';

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
  description: string;
  type: 'personal' | 'project';
  ownerId: string;
  projectId: string | null;
  createdUserId: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: string; // ISO-8601 timestamp
  updatedAt: string; // ISO-8601 timestamp
  deletedAt: string; // ISO-8601 timestamp
  metadata?: Record<string, unknown>; // Custom metadata including model configuration
}

/**
 * LLM execution status for messages
 */
export type LLMStatus =
  | 'success'
  | 'error'
  | 'timeout'
  | 'partial'
  | 'rate_limited'
  | 'invalid_request';

/**
 * Message DTO from Moku API
 */
export interface MessageDTO {
  id: string; // UUID as string
  threadId: string; // UUID as string
  branchId: string | null;
  model: string | null;
  provider: string | null;
  role: string | null;
  content: unknown; // JSONB content from API
  rawData: unknown; // JSONB from llm_responses
  status: LLMStatus | null; // LLM execution status
  options: unknown; // JSONB from llm_requests
  createdUserId: string | null;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
}

/**
 * Request body for creating a new thread
 */
export interface CreateThreadRequest {
  title: string;
  projectId: string | null;
  agentId: string;
  applicationSlug: string;
  initialProvider?: string;
  initalModel?: string;
  metadata?: ThreadMetadata;
}

/**
 * Request body for updating a thread
 */
export interface UpdateThreadRequest {
  title?: string;
  status?: string; //'active' | 'archived' | 'deleted';
  projectId?: string | null;
  metadata?: ThreadMetadata;
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
