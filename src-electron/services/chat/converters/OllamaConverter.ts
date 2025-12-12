import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import type { ChatRequest as OllamaChatRequest } from 'ollama';

/**
 * Converter for Ollama-specific request/response formats
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class OllamaConverter {
  private constructor() {}

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
   * Convert internal ChatRequest to Ollama-specific format
   */
  static toOllamaRequest(request: ChatRequest): OllamaChatRequest {
    const threadId = this.extractThreadId(request);
    let _ret: OllamaChatRequest = {
      model: request.model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: request.streaming !== false,
      ...(threadId ? { thread_id: threadId } : {}),
    };
    return _ret;
  }

  /**
   * Convert internal ChatRequestWithOptions to Ollama-specific format
   */
  static toOllamaRequestWithOptions(request: ChatRequestWithOptions): OllamaChatRequest {
    const options = request.options || {};
    const threadId = this.extractThreadId(request);

    const ollamaRequest: OllamaChatRequest = {
      model: request.model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: request.streaming !== false,
      ...(threadId ? { thread_id: threadId } : {}),
    };

    // Build options object only with defined values
    const ollamaOptions: Record<string, unknown> = {};
    if (options.temperature !== undefined) {
      ollamaOptions.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      ollamaOptions.num_predict = options.maxTokens;
    }
    if (options.topP !== undefined) {
      ollamaOptions.top_p = options.topP;
    }
    if (options.frequencyPenalty !== undefined) {
      ollamaOptions.frequency_penalty = options.frequencyPenalty;
    }
    if (options.presencePenalty !== undefined) {
      ollamaOptions.presence_penalty = options.presencePenalty;
    }
    if (options.stop !== undefined) {
      ollamaOptions.stop = options.stop;
    }

    // Only add options if there are any
    if (Object.keys(ollamaOptions).length > 0) {
      ollamaRequest.options = ollamaOptions;
    }

    return ollamaRequest;
  }
}
