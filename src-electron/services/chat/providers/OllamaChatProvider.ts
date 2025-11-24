/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Ollama } from 'ollama';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import { OllamaConverter } from '../converters/OllamaConverter.js';

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

    // Handle streaming vs non-streaming
    if (ollamaRequest.stream) {
      const response = await this.ollama.chat({
        ...ollamaRequest,
        thread_id: (request as any).thread_id,
        stream: true,
      } as any);

      // Handle streaming response
      for await (const part of response) {
        console.log('[OllamaChatProvider] Received streaming part:', JSON.stringify(part, null, 2));

        // Skip completion messages
        if (part.done) {
          console.log('[OllamaChatProvider] Received completion signal');
          continue;
        }

        // Check if part has the expected structure
        if (!part.message) {
          console.error(
            '[OllamaChatProvider] Unexpected response structure - missing message:',
            part,
          );
          continue;
        }

        const token = part.message.content;
        if (token && onTokenReceived) {
          onTokenReceived(token);
        }
      }
    } else {
      const response: any = await this.ollama.chat({
        ...ollamaRequest,
        thread_id: (request as any).thread_id,
        stream: false,
      } as any);

      console.log(
        '[OllamaChatProvider] Received non-streaming response:',
        JSON.stringify(response, null, 2),
      );

      // Handle non-streaming response
      if (response.message && onTokenReceived) {
        onTokenReceived(response.message.content);
      }
    }
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

    // Handle streaming vs non-streaming
    if (ollamaRequest.stream) {
      const response = await this.ollama.chat({
        ...ollamaRequest,
        thread_id: (request as any).thread_id,
        stream: true,
      } as any);

      // Handle streaming response
      for await (const part of response) {
        console.log('[OllamaChatProvider] Received streaming part:', JSON.stringify(part, null, 2));

        // Skip completion messages
        if (part.done) {
          console.log('[OllamaChatProvider] Received completion signal');
          continue;
        }

        // Check if part has the expected structure
        if (!part.message) {
          console.error(
            '[OllamaChatProvider] Unexpected response structure - missing message:',
            part,
          );
          continue;
        }

        const token = part.message.content;
        if (token && onTokenReceived) {
          onTokenReceived(token);
        }
      }
    } else {
      const response: any = await this.ollama.chat({
        ...ollamaRequest,
        thread_id: (request as any).thread_id,
        stream: false,
      } as any);

      console.log(
        '[OllamaChatProvider] Received non-streaming response:',
        JSON.stringify(response, null, 2),
      );

      // Handle non-streaming response
      if (response.message && onTokenReceived) {
        onTokenReceived(response.message.content);
      }
    }
  }
}
