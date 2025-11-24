import Perplexity from '@perplexity-ai/perplexity_ai';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import {
  PerplexityAIConverter,
  type PerplexityChatRequest,
  type PerplexityChatRequestNonStreaming,
  type PerplexityChatRequestStreaming,
} from '../converters/PerplexityAIConverter.js';

/**
 * Perplexity chat provider using the native Perplexity API surface.
 */
export class PerplexityChatProvider implements IChatProvider {
  private readonly client: Perplexity;
  private defaultModel: string;

  constructor(url: string, apiKey: string, defaultModel: string) {
    this.client = new Perplexity({
      apiKey,
      baseURL: (url || 'https://api.perplexity.ai').replace(/\/$/, ''),
    });
    this.defaultModel = defaultModel || 'sonar';

    console.log(`PerplexityChatProvider initialized with model ${this.defaultModel}`);
  }

  public async chat(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;
    const perplexityRequest = PerplexityAIConverter.toPerplexityRequest({
      ...request,
      model: modelToUse,
    });

    await this.sendCompletion(perplexityRequest, onTokenReceived);
  }

  public async chatWithOptions(
    request: ChatRequestWithOptions,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;
    const perplexityRequest = PerplexityAIConverter.toPerplexityRequestWithOptions({
      ...request,
      model: modelToUse,
    });

    await this.sendCompletion(perplexityRequest, onTokenReceived);
  }

  private async sendCompletion(
    body: PerplexityChatRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    if (this.isStreamingRequest(body)) {
      await this.handleStreamingResponse(body, onTokenReceived);
      return;
    }

    await this.handleNonStreamingResponse(body, onTokenReceived);
  }

  private async handleStreamingResponse(
    body: PerplexityChatRequestStreaming,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const stream = await this.client.chat.completions.create(body);

    for await (const chunk of stream) {
      const content = this.extractContent(chunk.choices?.[0]?.delta?.content);
      if (content && onTokenReceived) {
        onTokenReceived(content);
      }
    }
  }

  private async handleNonStreamingResponse(
    body: PerplexityChatRequestNonStreaming,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const completion = await this.client.chat.completions.create(body);
    const content = this.extractContent(completion.choices?.[0]?.message?.content);

    if (content && onTokenReceived) {
      onTokenReceived(content);
    }
  }

  private extractContent(content: Perplexity.ChatMessageOutput['content'] | undefined): string {
    if (!content) {
      return '';
    }

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((chunk) => {
          if (chunk.type === 'text' && 'text' in chunk) {
            return chunk.text ?? '';
          }
          return '';
        })
        .join('');
    }

    return '';
  }

  private isStreamingRequest(body: PerplexityChatRequest): body is PerplexityChatRequestStreaming {
    return body.stream === true;
  }
}
