import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import type { ChatRequest as OllamaChatRequest } from 'ollama';

/**
 * Converter for Ollama-specific request/response formats
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class OllamaConverter {
  private constructor() {}

  /**
   * Convert internal ChatRequest to Ollama-specific format
   */
  static toOllamaRequest(request: ChatRequest): OllamaChatRequest {
    let _ret: OllamaChatRequest = {
      model: request.model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: request.streaming !== false,
    };
    return _ret;
    // return {
    //     model: request.model,
    //     messages: request.messages.map(m => ({ role: m.role, content: m.content })),
    //     stream: request.streaming !== false
    // };
  }

  /**
   * Convert internal ChatRequestWithOptions to Ollama-specific format
   */
  static toOllamaRequestWithOptions(request: ChatRequestWithOptions): OllamaChatRequest {
    const options = request.options || {};

    const ollamaRequest: OllamaChatRequest = {
      model: request.model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: request.streaming !== false,
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
