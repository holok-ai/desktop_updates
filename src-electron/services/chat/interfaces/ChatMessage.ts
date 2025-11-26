import type { Attachment } from '../../../../src-shared/types/attachment.types.js';

/**
 * Represents a single message in a chat conversation
 */
export interface ChatMessage {
  role: string;
  content: string;
  attachments?: Attachment[]; // Optional file attachments for multi-modal support
}

/**
 * Common chat request interface for all providers
 */
export interface ChatRequest {
  messages: ChatMessage[];
  streaming?: boolean;
  model: string;
}

/**
 * Provider-specific options for chat requests
 */
export interface ProviderOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  [key: string]: unknown; // For provider-specific options
}

/**
 * Extended chat request with provider options
 */
export interface ChatRequestWithOptions extends ChatRequest {
  options?: ProviderOptions;
}

/**
 * Chat API request interface (used by ChatApiService)
 */
export interface ChatApiRequest {
  messages: ChatMessage[];
  streaming?: boolean;
  model: string;
}

// Runtime helpers (exported so unit tests can exercise this module and
// improve coverage for the otherwise type-only file).
export function makeChatMessage(role: string, content: string): ChatMessage {
  return { role, content };
}

export function isChatMessage(obj: unknown): obj is ChatMessage {
  // Basic runtime check without using `any`.
  if (typeof obj !== 'object' || obj === null) return false;
  const rec = obj as Record<string, unknown>;
  return typeof rec['role'] === 'string' && typeof rec['content'] === 'string';
}
