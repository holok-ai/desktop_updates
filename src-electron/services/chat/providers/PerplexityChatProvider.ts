import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import {
  PerplexityAIConverter,
  type PerplexityChatRequest,
  type PerplexityChatRequestWithOptions,
} from '../converters/PerplexityAIConverter.js';

type PerplexityChatCompletion = {
  id: string;
  choices: Array<{
    message?: {
      role: string;
      content?: string;
    };
  }>;
};

type PerplexityChatCompletionChunk = {
  id: string;
  choices: Array<{
    delta?: {
      role?: string;
      content?: string;
    };
  }>;
};

/**
 * Perplexity chat provider using the native Perplexity API surface.
 */
export class PerplexityChatProvider implements IChatProvider {
  private readonly baseURL: string;
  private readonly apiKey: string;
  private defaultModel: string;

  constructor(url: string, apiKey: string, defaultModel: string) {
    this.baseURL = (url || 'https://api.perplexity.ai').replace(/\/$/, '');
    this.apiKey = apiKey;
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

    await this.sendCompletion(perplexityRequest, request.streaming !== false, onTokenReceived);
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

    await this.sendCompletion(
      perplexityRequest,
      request.streaming !== false,
      onTokenReceived,
    );
  }

  private async sendCompletion(
    body: PerplexityChatRequest | PerplexityChatRequestWithOptions,
    streaming: boolean,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const payload = streaming ? { ...body, stream: true } : body;
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Perplexity API error (${response.status} ${response.statusText}): ${errorText}`,
      );
    }

    if (streaming) {
      await this.handleStreamResponse(response, onTokenReceived);
      return;
    }

    const completion = (await response.json()) as PerplexityChatCompletion;
    const content = completion.choices?.[0]?.message?.content || '';
    if (content && onTokenReceived) {
      onTokenReceived(content);
    }
  }

  private async handleStreamResponse(
    response: Response,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    if (!response.body) {
      throw new Error('Perplexity streaming response is missing a body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = this.processBufferedSSE(buffer, onTokenReceived);
    }

    // Flush whatever remains
    this.processBufferedSSE(buffer, onTokenReceived, true);
  }

  private processBufferedSSE(
    buffer: string,
    onTokenReceived?: (token: string) => void,
    isFinal = false,
  ): string {
    let workingBuffer = buffer;

    while (true) {
      const separatorIndex = workingBuffer.indexOf('\n\n');
      if (separatorIndex === -1) {
        break;
      }

      const rawEvent = workingBuffer.slice(0, separatorIndex).trim();
      workingBuffer = workingBuffer.slice(separatorIndex + 2);
      this.dispatchEvent(rawEvent, onTokenReceived);
    }

    if (isFinal && workingBuffer.trim().length > 0) {
      this.dispatchEvent(workingBuffer.trim(), onTokenReceived);
      return '';
    }

    return workingBuffer;
  }

  private dispatchEvent(eventPayload: string, onTokenReceived?: (token: string) => void): void {
    if (!eventPayload) {
      return;
    }

    for (const line of eventPayload.split('\n')) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('data:')) {
        continue;
      }

      const data = trimmedLine.slice(5).trim();
      if (!data || data === '[DONE]') {
        continue;
      }

      try {
        const parsed = JSON.parse(data) as PerplexityChatCompletionChunk;
        const content = parsed.choices?.[0]?.delta?.content || '';
        if (content && onTokenReceived) {
          onTokenReceived(content);
        }
      } catch (error) {
        console.warn('Unable to parse Perplexity SSE payload', error);
      }
    }
  }
}

