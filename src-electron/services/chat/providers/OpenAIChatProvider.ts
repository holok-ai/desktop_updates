import OpenAI from 'openai';
import type { Stream } from 'openai/core/streaming';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import type { ToolDefinition, ToolResult } from '../../file-tools.service.js';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import { OpenAIConverter } from '../converters/OpenAIConverter.js';

type ToolUseRequest = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

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
    const threadContext = this.extractThreadContext(request);

    const shouldStream = request.streaming !== false;

    if (shouldStream) {
      const params: ChatCompletionCreateParamsStreaming = {
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
      const params: ChatCompletionCreateParamsNonStreaming = {
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
    const threadContext = this.extractThreadContext(request);

    const optionalParams = this.buildOptionalParams(openaiRequest);

    const shouldStream = request.streaming !== false;

    if (shouldStream) {
      const params: ChatCompletionCreateParamsStreaming = {
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
      const params: ChatCompletionCreateParamsNonStreaming = {
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
    const normalized = (this.defaultModel || '').toLowerCase();
    return normalized.includes('gpt-4');
  }

  public async chatWithTools(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolUse: ToolUseRequest) => Promise<ToolResult>,
  ): Promise<void> {
    const modelToUse = request.model || this.defaultModel;

    if (!tools.length || !this.supportsTools() || !onToolUse) {
      await this.chat({ ...request, model: modelToUse }, onTokenReceived);
      return;
    }

    const openaiRequest = OpenAIConverter.toOpenAIRequest({ ...request, model: modelToUse });
    const functions = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    }));
    const threadContext = this.extractThreadContext(request);
    const shouldStream = request.streaming !== false;
    let messages = openaiRequest.messages;
    const maxIterations = 8;

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const updatedMessages = await this.processToolIteration(
        iteration,
        {
          functions,
          messages,
          model: modelToUse,
          shouldStream,
          threadContext,
        },
        onTokenReceived,
        onToolUse,
      );

      if (!updatedMessages) {
        return;
      }

      messages = updatedMessages;
    }

    throw new Error('Tool loop exceeded maximum iterations');
  }

  private async processToolIteration(
    iteration: number,
    context: {
      messages: ChatCompletionMessageParam[];
      functions: {
        name: string;
        description: string;
        parameters: ToolDefinition['input_schema'];
      }[];
      model: string;
      shouldStream: boolean;
      threadContext: Record<string, unknown>;
    },
    onTokenReceived: ((token: string) => void) | undefined,
    onToolUse: (toolUse: ToolUseRequest) => Promise<ToolResult>,
  ): Promise<ChatCompletionMessageParam[] | null> {
    const response = await this.createToolAwareResponse(
      {
        functions: context.functions,
        messages: context.messages,
        model: context.model,
        shouldStream: context.shouldStream,
        threadContext: context.threadContext,
      },
      onTokenReceived,
    );

    if (!response) {
      return null;
    }

    const functionCall = this.extractFunctionCall(response);
    if (!functionCall) {
      return null;
    }

    const toolUse: ToolUseRequest = {
      id: `call_${Date.now()}_${iteration}`,
      name: functionCall.name,
      input: this.parseToolArguments(functionCall.arguments ?? '{}'),
    };

    const result = await onToolUse(toolUse);
    return this.appendToolInteraction(
      context.messages,
      response.choices[0].message,
      functionCall.name,
      result,
    );
  }

  private extractThreadContext(
    request: ChatRequest,
  ): Record<string, string> | Record<string, never> {
    const threadId = (request as unknown as { thread_id?: string }).thread_id;
    return threadId ? { thread_id: threadId } : {};
  }

  private async createToolAwareResponse(
    params: {
      messages: ChatCompletionMessageParam[];
      functions: {
        name: string;
        description: string;
        parameters: ToolDefinition['input_schema'];
      }[];
      model: string;
      shouldStream: boolean;
      threadContext: Record<string, unknown>;
    },
    onTokenReceived?: (token: string) => void,
  ): Promise<ChatCompletion | null> {
    if (params.shouldStream) {
      return this.createStreamingToolResponse(params, onTokenReceived);
    }

    return this.createNonStreamingToolResponse(params, onTokenReceived);
  }

  private async createStreamingToolResponse(
    params: {
      messages: ChatCompletionMessageParam[];
      functions: {
        name: string;
        description: string;
        parameters: ToolDefinition['input_schema'];
      }[];
      model: string;
      threadContext: Record<string, unknown>;
    },
    onTokenReceived?: (token: string) => void,
  ): Promise<ChatCompletion | null> {
    const stream = await this.client.chat.completions.create({
      ...params.threadContext,
      model: params.model,
      messages: params.messages,
      functions: params.functions,
      stream: true,
    });

    let functionCall: { name: string; arguments: string } | null = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      this.emitStreamingContent(delta, onTokenReceived);
      functionCall = this.collectFunctionCallDelta(functionCall, delta);
    }

    if (!functionCall) {
      return null;
    }

    return {
      choices: [
        {
          finish_reason: 'function_call',
          message: {
            role: 'assistant',
            function_call: functionCall,
            content: null,
          },
        },
      ],
    } as ChatCompletion;
  }

  private async createNonStreamingToolResponse(
    params: {
      messages: ChatCompletionMessageParam[];
      functions: {
        name: string;
        description: string;
        parameters: ToolDefinition['input_schema'];
      }[];
      model: string;
      threadContext: Record<string, unknown>;
    },
    onTokenReceived?: (token: string) => void,
  ): Promise<ChatCompletion> {
    const response = await this.client.chat.completions.create({
      ...params.threadContext,
      model: params.model,
      messages: params.messages,
      functions: params.functions,
      stream: false,
    });

    const content = response.choices[0]?.message?.content;
    if (content && onTokenReceived) {
      onTokenReceived(content);
    }

    return response;
  }

  private extractFunctionCall(
    response: ChatCompletion,
  ): { name: string; arguments?: string } | null {
    const choice = response.choices[0];
    if (choice?.finish_reason !== 'function_call') {
      return null;
    }

    const fnCall = choice?.message?.function_call;
    if (!fnCall) {
      return null;
    }

    return {
      name: fnCall.name,
      arguments: fnCall.arguments,
    };
  }

  private parseToolArguments(rawArgs: string): Record<string, unknown> {
    if (!rawArgs) {
      return {};
    }

    try {
      const parsed: unknown = JSON.parse(rawArgs);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }

      return {};
    } catch (error) {
      console.warn('[OpenAIChatProvider] Failed to parse tool arguments', {
        error,
        raw: rawArgs,
      });
      return {};
    }
  }

  private appendToolInteraction(
    messages: ChatCompletionMessageParam[],
    assistantMessage: ChatCompletion['choices'][number]['message'],
    toolName: string,
    result: ToolResult,
  ): ChatCompletionMessageParam[] {
    const assistantEntry: ChatCompletionMessageParam = { role: 'assistant' };
    if (assistantMessage?.content) {
      assistantEntry.content = assistantMessage.content;
    }
    if (assistantMessage?.function_call) {
      assistantEntry.function_call = assistantMessage.function_call;
    }

    const functionResponse: ChatCompletionMessageParam = {
      role: 'function',
      name: toolName,
      content: JSON.stringify(result),
    };

    return [...messages, assistantEntry, functionResponse];
  }

  private emitStreamingContent(
    delta: ChatCompletionChunk['choices'][number]['delta'] | undefined,
    onTokenReceived?: (token: string) => void,
  ): void {
    if (delta?.content && onTokenReceived) {
      onTokenReceived(delta.content);
    }
  }

  private collectFunctionCallDelta(
    current: { name: string; arguments: string } | null,
    delta: ChatCompletionChunk['choices'][number]['delta'] | undefined,
  ): { name: string; arguments: string } | null {
    if (!delta?.function_call) {
      return current;
    }

    const next = current ?? { name: '', arguments: '' };
    if (typeof delta.function_call.name === 'string') {
      next.name += delta.function_call.name;
    }
    if (typeof delta.function_call.arguments === 'string') {
      next.arguments += delta.function_call.arguments;
    }

    return next;
  }

  private buildOptionalParams(
    openaiRequest: ReturnType<typeof OpenAIConverter.toOpenAIRequestWithOptions>,
  ): Partial<Pick<ChatCompletionCreateParamsNonStreaming, OptionalParamKeys>> {
    const optionalParams: Partial<Pick<ChatCompletionCreateParamsNonStreaming, OptionalParamKeys>> =
      {};

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
