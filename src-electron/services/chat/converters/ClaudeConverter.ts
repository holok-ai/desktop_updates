import type {
  ChatMessage,
  ChatRequest,
  ChatRequestWithOptions,
} from '../interfaces/ChatMessage.js';
import type { MessageParam } from '@anthropic-ai/sdk/resources';

/**
 * Converter for Claude-specific request/response formats
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ClaudeConverter {
  private constructor() {}

  /**
   * Map internal message role to Claude's expected format
   */
  private static mapRole(role: string): 'user' | 'assistant' {
    // Claude API only accepts 'user' and 'assistant' roles in messages
    // System prompts should be passed via the 'system' parameter in MessageCreateParams
    switch (role.toLowerCase()) {
      case 'assistant':
        return 'assistant';
      case 'user':
      case 'system':
      default:
        // Default to user for system and unknown roles
        return 'user';
    }
  }

  /**
   * Convert internal ChatMessage to Claude's MessageParam format
   */
  private static mapMessage(message: ChatMessage): MessageParam {
    return {
      role: this.mapRole(message.role),
      content: message.content,
    };
  }

  private static extractThreadId(
    request: ChatRequest | ChatRequestWithOptions,
  ): string | undefined {
    const threadId = (request as { thread_id?: string }).thread_id;
    if (typeof threadId === 'string' && threadId.length > 0) {
      return threadId;
    }

    return undefined;
  }

  /**
   * Convert internal ChatRequest to Claude-specific format
   */
  static toClaudeRequest(request: ChatRequest): {
    model: string;
    messages: MessageParam[];
    stream: boolean;
  } {
    const threadId = this.extractThreadId(request);
    const claudeRequest: {
      model: string;
      messages: MessageParam[];
      stream: boolean;
      thread_id?: string;
    } = {
      model: request.model,
      messages: request.messages.map((m) => this.mapMessage(m)),
      stream: request.streaming !== false,
      ...(threadId ? { thread_id: threadId } : {}),
    };

    return claudeRequest;
  }

  /**
   * Convert internal ChatRequestWithOptions to Claude-specific format
   */
  static toClaudeRequestWithOptions(request: ChatRequestWithOptions): Record<string, unknown> {
    const options = request.options || {};
    const threadId = this.extractThreadId(request);

    const claudeRequest: Record<string, unknown> = {
      model: request.model,
      messages: request.messages.map((m) => this.mapMessage(m)),
      stream: request.streaming !== false,
      ...(threadId ? { thread_id: threadId } : {}),
    };

    // Add optional parameters only if defined
    if (options.temperature !== undefined) {
      claudeRequest.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      claudeRequest.max_tokens = options.maxTokens;
    }
    if (options.topP !== undefined) {
      claudeRequest.top_p = options.topP;
    }
    if (options.stop !== undefined) {
      claudeRequest.stop_sequences = options.stop;
    }

    return claudeRequest;
  }
}
