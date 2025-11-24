/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import OpenAI from 'openai';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import { OpenAIConverter } from '../converters/OpenAIConverter.js';

export class OpenAIChatProvider implements IChatProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(baseURL: string, apiKey: string, defaultModel: string) {
    this.client = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });
    this.defaultModel = defaultModel || 'gpt-3.5-turbo';

    console.log(`OpenAIChatProvider initialized with model ${this.defaultModel}`);
  }

  /**
   * Send a chat request to OpenAI
   */
  public async chat(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;
    const openaiRequest = OpenAIConverter.toOpenAIRequest({ ...request, model: modelToUse });

    if (request.streaming !== false) {
      const stream: any = await this.client.chat.completions.create({
        model: openaiRequest.model,
        messages: openaiRequest.messages,
        stream: true,
        thread_id: (request as any).thread_id,
      } as any);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content && onTokenReceived) {
          onTokenReceived(content);
        }
      }
    } else {
      const response = await this.client.chat.completions.create({
        model: openaiRequest.model,
        messages: openaiRequest.messages,
        thread_id: (request as any).thread_id,
      } as any);

      const content = response.choices[0]?.message?.content || '';
      if (content && onTokenReceived) {
        onTokenReceived(content);
      }
    }
  }

  /**
   * Send a chat request with additional options to OpenAI
   */
  public async chatWithOptions(
    request: ChatRequestWithOptions,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;
    const openaiRequest = OpenAIConverter.toOpenAIRequestWithOptions({
      ...request,
      model: modelToUse,
    });

    if (request.streaming !== false) {
      const stream: any = await this.client.chat.completions.create({
        model: openaiRequest.model as string,
        messages:
          openaiRequest.messages as import('openai/resources/chat').ChatCompletionMessageParam[],
        temperature: openaiRequest.temperature as number | undefined,
        max_tokens: openaiRequest.max_tokens as number | undefined,
        top_p: openaiRequest.top_p as number | undefined,
        frequency_penalty: openaiRequest.frequency_penalty as number | undefined,
        presence_penalty: openaiRequest.presence_penalty as number | undefined,
        stop: openaiRequest.stop as string[] | undefined,
        stream: true,
        thread_id: (request as any).thread_id,
      } as any);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content && onTokenReceived) {
          onTokenReceived(content);
        }
      }
    } else {
      const response = await this.client.chat.completions.create({
        model: openaiRequest.model as string,
        messages:
          openaiRequest.messages as import('openai/resources/chat').ChatCompletionMessageParam[],
        temperature: openaiRequest.temperature as number | undefined,
        max_tokens: openaiRequest.max_tokens as number | undefined,
        top_p: openaiRequest.top_p as number | undefined,
        frequency_penalty: openaiRequest.frequency_penalty as number | undefined,
        presence_penalty: openaiRequest.presence_penalty as number | undefined,
        stop: openaiRequest.stop as string[] | undefined,
        thread_id: (request as any).thread_id,
      } as any);

      const content = response.choices[0]?.message?.content || '';
      if (content && onTokenReceived) {
        onTokenReceived(content);
      }
    }
  }
}
