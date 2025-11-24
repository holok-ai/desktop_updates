// src/lib/services/interfaces/IChatProvider.ts
import type { ChatRequest, ChatRequestWithOptions } from './ChatMessage.js';
import type { ToolDefinition, ToolResult } from '../../file-tools.service.js';

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Core interface for all chat providers
 */
export interface IChatProvider {
  /**
   * Sends a chat request to the provider and handles streaming response
   * @param request The chat request containing messages and model
   * @param onTokenReceived Callback function to handle streamed tokens
   */
  chat(request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void>;

  /**
   * Sends a chat request with additional provider-specific options
   * @param request The extended chat request with provider options
   * @param onTokenReceived Callback function to handle streamed tokens
   */
  chatWithOptions(
    request: ChatRequestWithOptions,
    onTokenReceived?: (token: string) => void,
  ): Promise<void>;

  /**
   * Check if provider supports tool calling
   */
  supportsTools(): boolean;

  /**
   * Send chat with tools enabled (optional - only for providers that support it)
   */
  chatWithTools?(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>
  ): Promise<void>;
}

// Runtime helpers to allow testing/type-guards for this interface
export function isIChatProvider(obj: unknown): obj is IChatProvider {
  // Use safe checks against unknown shape without using `any`.
  if (!obj) return false;
  const asRecord = obj as Record<string, unknown>;
  return (
    typeof asRecord['chat'] === 'function' &&
    typeof asRecord['chatWithOptions'] === 'function' &&
    typeof asRecord['supportsTools'] === 'function'
  );
}

export function makeMockProvider(tokens: string[] = ['t1', 't2']): IChatProvider {
  return {
    chat(_request: ChatRequest, onTokenReceived?: (token: string) => void): Promise<void> {
      if (onTokenReceived) {
        for (const t of tokens) onTokenReceived(t);
      }
      return Promise.resolve();
    },
    chatWithOptions(
      _request: ChatRequestWithOptions,
      onTokenReceived?: (token: string) => void,
    ): Promise<void> {
      if (onTokenReceived) {
        for (const t of tokens) onTokenReceived(t + '_opt');
      }
      return Promise.resolve();
    },
    supportsTools(): boolean {
      return false;
    },
  };
}
