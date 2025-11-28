import type {
  ChatMessage,
  ChatRequest,
  ChatRequestWithOptions,
} from '../interfaces/ChatMessage.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

type OpenAIBaseRequest = {
  model: string;
  messages: ChatCompletionMessageParam[];
  stream: boolean;
};

type OpenAIRequestWithOptions = OpenAIBaseRequest & {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
};

/**
 * Converter for OpenAI-specific request/response formats
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class OpenAIConverter {
  private constructor() {}

  /**
   * Map internal message format to OpenAI's ChatCompletionMessageParam
   */
  private static mapMessage(message: ChatMessage): ChatCompletionMessageParam {
    // Map to appropriate role - only system, user, and assistant are supported in basic messages
    const role = message.role.toLowerCase();

    if (role === 'assistant') {
      return { role: 'assistant', content: message.content };
    } else if (role === 'system') {
      return { role: 'system', content: message.content };
    } else {
      // Default to user for all other roles
      return { role: 'user', content: message.content };
    }
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
   * Convert internal ChatRequest to OpenAI-specific format
   */
  static toOpenAIRequest(request: ChatRequest): OpenAIBaseRequest {
    const threadId = this.extractThreadId(request);
    const baseRequest: OpenAIBaseRequest = {
      model: request.model,
      messages: request.messages.map((m) => this.mapMessage(m)),
      stream: request.streaming !== false,
      ...(threadId ? { thread_id: threadId } : {}),
    };
    return baseRequest;
  }

  /**
   * Convert internal ChatRequestWithOptions to OpenAI-specific format
   */
  static toOpenAIRequestWithOptions(request: ChatRequestWithOptions): OpenAIRequestWithOptions {
    const options = request.options || {};
    const threadId = this.extractThreadId(request);

    const openaiRequest: OpenAIRequestWithOptions = {
      model: request.model,
      messages: request.messages.map((m) => this.mapMessage(m)),
      stream: request.streaming !== false,
      ...(threadId ? { thread_id: threadId } : {}),
    };

    // Add optional parameters only if defined
    if (options.temperature !== undefined) {
      openaiRequest.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      openaiRequest.max_tokens = options.maxTokens;
    }
    if (options.topP !== undefined) {
      openaiRequest.top_p = options.topP;
    }
    if (options.frequencyPenalty !== undefined) {
      openaiRequest.frequency_penalty = options.frequencyPenalty;
    }
    if (options.presencePenalty !== undefined) {
      openaiRequest.presence_penalty = options.presencePenalty;
    }
    if (options.stop !== undefined) {
      openaiRequest.stop = options.stop;
    }

    return openaiRequest;
  }
}
