/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Ollama } from 'ollama';
import type { ChatRequest as OllamaChatRequest, ChatResponse } from 'ollama';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import { OllamaConverter } from '../converters/OllamaConverter.js';

type ThreadAwareRequest = { thread_id?: string };
type ThreadAwareOllamaRequest = OllamaChatRequest & ThreadAwareRequest;

export class OllamaChatProvider implements IChatProvider {
  private ollama: Ollama;
  private defaultModel: string;

  constructor(apiEndpoint: string, apiKey: string, defaultModel: string) {
    this.ollama = new Ollama({
      host: apiEndpoint,
      headers: {
        'X-api-key': apiKey,
      },
    });
    this.defaultModel = defaultModel;
    console.log(
      `OllamaChatProvider initialized with endpoint ${apiEndpoint} and model ${defaultModel} and key ${apiKey}`,
    );
  }

  /**
   * Send a chat request to Ollama
   */
  public async chat(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;
    const requestWithModel = { ...request, model: modelToUse };

    const ollamaRequest = OllamaConverter.toOllamaRequest(requestWithModel);
    console.log('[OllamaChatProvider] Sending request:', JSON.stringify(ollamaRequest, null, 2));

    await this.executeChatRequest(ollamaRequest, request.thread_id, onTokenReceived);
  }

  /**
   * Send a chat request with additional options to Ollama
   */
  public async chatWithOptions(
    request: ChatRequestWithOptions,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;
    const requestWithModel = { ...request, model: modelToUse };

    const ollamaRequest = OllamaConverter.toOllamaRequestWithOptions(requestWithModel);
    console.log(
      '[OllamaChatProvider] Sending request with options:',
      JSON.stringify(ollamaRequest, null, 2),
    );

    await this.executeChatRequest(ollamaRequest, request.thread_id, onTokenReceived);
  }

  public supportsTools(): boolean {
    return false;
  }

  private async executeChatRequest(
    ollamaRequest: OllamaChatRequest,
    threadId: string | undefined,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    if (ollamaRequest.stream) {
      const streamingRequest = this.buildThreadAwareRequest(ollamaRequest, threadId, true);
      const response = await this.ollama.chat(streamingRequest);
      await this.processStreamingResponse(response, onTokenReceived);
      return;
    }

    const nonStreamingRequest = this.buildThreadAwareRequest(ollamaRequest, threadId, false);
    const response: ChatResponse = await this.ollama.chat(nonStreamingRequest);
    console.log('[OllamaChatProvider] Received non-streaming response:', JSON.stringify(response, null, 2));
    this.emitNonStreamingResponse(response, onTokenReceived);
  }

  private buildThreadAwareRequest<TStream extends boolean>(
    request: OllamaChatRequest,
    threadId: string | undefined,
    stream: TStream,
  ): ThreadAwareOllamaRequest & { stream: TStream } {
    return {
      ...request,
      ...(threadId ? { thread_id: threadId } : {}),
      stream,
    };
  }

  private async processStreamingResponse(
    response: AsyncIterable<ChatResponse>,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    for await (const part of response) {
      console.log('[OllamaChatProvider] Received streaming part:', JSON.stringify(part, null, 2));

      if (part.done) {
        console.log('[OllamaChatProvider] Received completion signal');
        continue;
      }

      const token = part.message?.content;
      if (!token) {
        console.error('[OllamaChatProvider] Unexpected response structure - missing message:', part);
        continue;
      }

      if (token && onTokenReceived) {
        onTokenReceived(token);
      }
    }
  }

  private emitNonStreamingResponse(
    response: ChatResponse,
    onTokenReceived?: (token: string) => void,
  ): void {
    if (response.message?.content && onTokenReceived) {
      onTokenReceived(response.message.content);
    }
  }
}
