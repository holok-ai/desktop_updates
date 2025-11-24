import OpenAI from 'openai';
import type { Stream } from 'openai/core/streaming';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat/completions';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import { OpenAIConverter } from '../converters/OpenAIConverter.js';

type ThreadAwareStreamingParams = ChatCompletionCreateParamsStreaming;
type ThreadAwareNonStreamingParams = ChatCompletionCreateParamsNonStreaming;
type OptionalParamKeys =
  | 'temperature'
  | 'max_tokens'
  | 'top_p'
  | 'frequency_penalty'
  | 'presence_penalty'
  | 'stop';

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
    const threadContext = (request as unknown as { thread_id?: string }).thread_id ? { thread_id: (request as unknown as { thread_id?: string }).thread_id } : {};

    const shouldStream = request.streaming !== false;

    if (shouldStream) {
      const params: ThreadAwareStreamingParams = {
        ...threadContext,
        model: openaiRequest.model,
        messages: openaiRequest.messages,
        stream: true,
      };

      const stream: Stream<ChatCompletionChunk> = await this.client.chat.completions.create(params);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content && onTokenReceived) {
          onTokenReceived(content);
        }
      }
    } else {
      const params: ThreadAwareNonStreamingParams = {
        ...threadContext,
        model: openaiRequest.model,
        messages: openaiRequest.messages,
        stream: false,
      };

      const response: ChatCompletion = await this.client.chat.completions.create(params);

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
    const threadContext = (request as unknown as { thread_id?: string }).thread_id ? { thread_id: (request as unknown as { thread_id?: string }).thread_id } : {};

    const optionalParams = this.buildOptionalParams(openaiRequest);

    const shouldStream = request.streaming !== false;

    if (shouldStream) {
      const params: ThreadAwareStreamingParams = {
        ...threadContext,
        model: openaiRequest.model,
        messages: openaiRequest.messages,
        stream: true,
        ...optionalParams,
      };

      const stream: Stream<ChatCompletionChunk> = await this.client.chat.completions.create(params);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content && onTokenReceived) {
          onTokenReceived(content);
        }
      }
    } else {
      const params: ThreadAwareNonStreamingParams = {
        ...threadContext,
        model: openaiRequest.model,
        messages: openaiRequest.messages,
        stream: false,
        ...optionalParams,
      };

      const response: ChatCompletion = await this.client.chat.completions.create(params);

      const content = response.choices[0]?.message?.content || '';
      if (content && onTokenReceived) {
        onTokenReceived(content);
      }
    }
  }

  public supportsTools(): boolean {
    return false;
  }

  private buildOptionalParams(
    openaiRequest: ReturnType<typeof OpenAIConverter.toOpenAIRequestWithOptions>,
  ): Partial<Pick<ThreadAwareNonStreamingParams, OptionalParamKeys>> {
    const optionalParams: Partial<Pick<ThreadAwareNonStreamingParams, OptionalParamKeys>> = {};

    if (typeof openaiRequest.temperature === 'number') {
      optionalParams.temperature = openaiRequest.temperature;
    }
    if (typeof openaiRequest.max_tokens === 'number') {
      optionalParams.max_tokens = openaiRequest.max_tokens;
    }
    if (typeof openaiRequest.top_p === 'number') {
      optionalParams.top_p = openaiRequest.top_p;
    }
    if (typeof openaiRequest.frequency_penalty === 'number') {
      optionalParams.frequency_penalty = openaiRequest.frequency_penalty;
    }
    if (typeof openaiRequest.presence_penalty === 'number') {
      optionalParams.presence_penalty = openaiRequest.presence_penalty;
    }
    if (Array.isArray(openaiRequest.stop)) {
      optionalParams.stop = openaiRequest.stop;
    }

    return optionalParams;
  }
}
