/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import Anthropic from '@anthropic-ai/sdk';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import { ClaudeConverter } from '../converters/ClaudeConverter.js';

export class ClaudeChatProvider implements IChatProvider {
  private client: Anthropic;
  private defaultModel: string;

  constructor(apiEndpoint: string, apiKey: string, defaultModel: string) {
    this.client = new Anthropic({
      apiKey,
      // baseURL: apiEndpoint,
      dangerouslyAllowBrowser: true,
    });
    if (apiEndpoint) {
      this.client.baseURL = apiEndpoint;
    }
    this.defaultModel = defaultModel || 'claude-3-opus-20240229';

    console.log(`ClaudeChatProvider initialized with model ${this.defaultModel}`);
  }

  /**
   * Send a chat request to Claude
   */
  public async chat(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;
    const claudeRequest = ClaudeConverter.toClaudeRequest({ ...request, model: modelToUse });
    const threadId = (claudeRequest as { thread_id?: string }).thread_id;

    try {
      const shouldStream = request.streaming !== false;
      if (shouldStream) {
        // Handle streaming request
        const stream = this.client.messages
          .stream({
            model: claudeRequest.model,
            messages: claudeRequest.messages,
            stream: true,
            max_tokens: 4096,
            ...(threadId && { thread_id: threadId }),
          } as any)
          .on('text', (text) => {
            if (onTokenReceived) {
              onTokenReceived(text);
            }
          });
        console.log('waiting for final message');
        const message = await stream.finalMessage();
        console.log(message);
      } else {
        // Handle non-streaming request
        const response = await this.client.messages.create({
          model: claudeRequest.model,
          messages: claudeRequest.messages,
          max_tokens: 4096,
          ...(threadId && { thread_id: threadId }),
        } as any);

        if (response.content && response.content.length > 0) {
          const content = response.content
            .filter((block) => block.type === 'text' && 'text' in block)
            .map((block) => (block as { text: string }).text)
            .join('');

          if (onTokenReceived) {
            onTokenReceived(content);
          }
        }
      }
    } catch (error) {
      console.error('Error in Claude API call:', error);
      throw error;
    }
  }

  /**
   * Check if provider supports tool calling
   */
  public supportsTools(): boolean {
    return false; // Claude provider does not support tools yet
  }

  /**
   * Send a chat request with additional options to Claude
   */
  public async chatWithOptions(
    request: ChatRequestWithOptions,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;
    const claudeRequest = ClaudeConverter.toClaudeRequestWithOptions({
      ...request,
      model: modelToUse,
    });
    const threadId = (claudeRequest as { thread_id?: string }).thread_id;

    try {
      const shouldStream = request.streaming !== false;
      if (shouldStream) {
        // Handle streaming request with options

        const stream = this.client.messages
          .stream({
            model: claudeRequest.model as string,
            messages:
              claudeRequest.messages as import('@anthropic-ai/sdk/resources').MessageParam[],
            temperature: claudeRequest.temperature as number | undefined,
            max_tokens: (claudeRequest.max_tokens as number | undefined) || 4096,
            top_p: claudeRequest.top_p as number | undefined,
            stop_sequences: claudeRequest.stop_sequences as string[] | undefined,
            stream: true,
            ...(threadId && { thread_id: threadId }),
          } as any)
          .on('text', (text) => {
            if (onTokenReceived) {
              onTokenReceived(text);
            }
          });
        const message = await stream.finalMessage();
        console.log(message);
      } else {
        // Handle non-streaming request with options
        const response = await this.client.messages.create({
          model: claudeRequest.model as string,
          messages: claudeRequest.messages as import('@anthropic-ai/sdk/resources').MessageParam[],
          temperature: claudeRequest.temperature as number | undefined,
          max_tokens: (claudeRequest.max_tokens as number | undefined) || 4096,
          top_p: claudeRequest.top_p as number | undefined,
          stop_sequences: claudeRequest.stop_sequences as string[] | undefined,
          ...(threadId && { thread_id: threadId }),
        } as any);

        if (response.content && response.content.length > 0) {
          const content = response.content
            .filter((block) => block.type === 'text' && 'text' in block)
            .map((block) => (block as { text: string }).text)
            .join('');

          if (onTokenReceived) {
            onTokenReceived(content);
          }
        }
      }
    } catch (error) {
      console.error('Error in Claude API call with options:', error);
      throw error;
    }
  }

}
