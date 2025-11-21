import OpenAI from 'openai';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import { OpenAIConverter } from '../converters/OpenAIConverter.js';

/**
 * Perplexity chat provider built on the OpenAI-compatible API surface.
 */
export class PerplexityChatProvider implements IChatProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(url: string, apiKey: string, defaultModel: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: url || 'https://api.perplexity.ai',
      dangerouslyAllowBrowser: true,
    });
    this.defaultModel = defaultModel || 'sonar';

    console.log(`PerplexityChatProvider initialized with model ${this.defaultModel}`);
  }

  public async chat(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;
    const perplexityRequest = OpenAIConverter.toOpenAIRequest({ ...request, model: modelToUse });

    if (request.streaming !== false) {
      const stream = await this.client.chat.completions.create({
        model: perplexityRequest.model,
        messages: perplexityRequest.messages,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content && onTokenReceived) {
          onTokenReceived(content);
        }
      }
    } else {
      const response = await this.client.chat.completions.create({
        model: perplexityRequest.model,
        messages: perplexityRequest.messages,
      });

      const content = response.choices[0]?.message?.content || '';
      if (content && onTokenReceived) {
        onTokenReceived(content);
      }
    }
  }

  public async chatWithOptions(
    request: ChatRequestWithOptions,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;
    const perplexityRequest = OpenAIConverter.toOpenAIRequestWithOptions({
      ...request,
      model: modelToUse,
    });

    if (request.streaming !== false) {
      const stream = await this.client.chat.completions.create({
        model: perplexityRequest.model as string,
        messages:
          perplexityRequest.messages as import('openai/resources/chat').ChatCompletionMessageParam[],
        temperature: perplexityRequest.temperature as number | undefined,
        max_tokens: perplexityRequest.max_tokens as number | undefined,
        top_p: perplexityRequest.top_p as number | undefined,
        frequency_penalty: perplexityRequest.frequency_penalty as number | undefined,
        presence_penalty: perplexityRequest.presence_penalty as number | undefined,
        stop: perplexityRequest.stop as string[] | undefined,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content && onTokenReceived) {
          onTokenReceived(content);
        }
      }
    } else {
      const response = await this.client.chat.completions.create({
        model: perplexityRequest.model as string,
        messages:
          perplexityRequest.messages as import('openai/resources/chat').ChatCompletionMessageParam[],
        temperature: perplexityRequest.temperature as number | undefined,
        max_tokens: perplexityRequest.max_tokens as number | undefined,
        top_p: perplexityRequest.top_p as number | undefined,
        frequency_penalty: perplexityRequest.frequency_penalty as number | undefined,
        presence_penalty: perplexityRequest.presence_penalty as number | undefined,
        stop: perplexityRequest.stop as string[] | undefined,
      });

      const content = response.choices[0]?.message?.content || '';
      if (content && onTokenReceived) {
        onTokenReceived(content);
      }
    }
  }
}

