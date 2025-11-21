import type PerplexityClient from '@perplexity-ai/perplexity_ai';
import type {
  ChatMessage,
  ChatRequest,
  ChatRequestWithOptions,
} from '../interfaces/ChatMessage.js';

export type PerplexityChatMessage = PerplexityClient.ChatMessageInput;
export type PerplexityChatRequest = PerplexityClient.Chat.CompletionCreateParams;
export type PerplexityChatRequestStreaming =
  PerplexityClient.Chat.CompletionCreateParamsStreaming;
export type PerplexityChatRequestNonStreaming =
  PerplexityClient.Chat.CompletionCreateParamsNonStreaming;

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PerplexityAIConverter {
  private constructor() {}

  private static mapMessage(message: ChatMessage): PerplexityChatMessage {
    const role = message.role.toLowerCase();

    if (role === 'assistant') {
      return { role: 'assistant', content: message.content };
    } else if (role === 'system') {
      return { role: 'system', content: message.content };
    }

    return { role: 'user', content: message.content };
  }

  static toPerplexityRequest(request: ChatRequest): PerplexityChatRequest {
    return {
      model: request.model,
      messages: request.messages.map((m) => this.mapMessage(m)),
      stream: request.streaming !== false,
    };
  }

  static toPerplexityRequestWithOptions(
    request: ChatRequestWithOptions,
  ): PerplexityChatRequest {
    const options = request.options || {};
    const perplexityRequest: PerplexityChatRequest = {
      model: request.model,
      messages: request.messages.map((m) => this.mapMessage(m)),
      stream: request.streaming !== false,
    };

    if (options.temperature !== undefined) {
      perplexityRequest.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      perplexityRequest.max_tokens = options.maxTokens;
    }
    if (options.topP !== undefined) {
      perplexityRequest.top_p = options.topP;
    }
    if (options.frequencyPenalty !== undefined) {
      perplexityRequest.frequency_penalty = options.frequencyPenalty;
    }
    if (options.presencePenalty !== undefined) {
      perplexityRequest.presence_penalty = options.presencePenalty;
    }
    if (options.stop !== undefined) {
      perplexityRequest.stop = options.stop;
    }

    return perplexityRequest;
  }
}