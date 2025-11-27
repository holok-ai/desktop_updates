import Perplexity from '@perplexity-ai/perplexity_ai';
import type PerplexityClient from '@perplexity-ai/perplexity_ai';
import type { ToolDefinition, ToolResult } from '../../file-tools.service.js';
import type { IChatProvider, ToolUse } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import {
  PerplexityAIConverter,
  type PerplexityChatRequest,
  type PerplexityChatRequestNonStreaming,
  type PerplexityChatRequestStreaming,
} from '../converters/PerplexityAIConverter.js';

type ChatMessageOutput = PerplexityClient.ChatMessageOutput;
type ChatCompletionChunkLike = {
  choices?: { delta?: { content?: ChatMessageOutput['content'] } }[];
};
type ChatCompletionLike = {
  choices?: { message?: { content?: ChatMessageOutput['content'] } }[];
};

/**
 * Perplexity chat provider using the native Perplexity SDK.
 */
export class PerplexityChatProvider implements IChatProvider {
  private readonly client: Perplexity;
  private defaultModel: string;
  private static readonly MAX_TOOL_ITERATIONS = 8;

  constructor(url: string, apiKey: string, defaultModel: string) {
    this.client = new Perplexity({
      apiKey,
      baseURL: url,
    });
    this.defaultModel = defaultModel || 'pplx-70b-online';
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

  public supportsTools(): boolean {
    return true;
  }

  public async chatWithTools(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>,
  ): Promise<void> {
    if (!tools.length || !onToolUse) {
      await this.chat(request, onTokenReceived);
      return;
    }

    await this.handleToolLoop(request, tools, onTokenReceived, onToolUse);
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
    for await (const chunk of stream as AsyncIterable<ChatCompletionChunkLike>) {
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
    const completion = (await this.client.chat.completions.create(
      body,
    )) as unknown as ChatCompletionLike;
    const content = this.extractContent(completion.choices?.[0]?.message?.content);

    if (content && onTokenReceived) {
      onTokenReceived(content);
    }
  }

  private extractContent(content: ChatMessageOutput['content'] | undefined): string {
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

  private async handleToolLoop(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived: ((token: string) => void) | undefined,
    onToolUse: (toolUse: ToolUse) => Promise<ToolResult>,
  ): Promise<void> {
    const toolInstruction = this.buildToolInstruction(tools);
    let conversation: ChatRequest['messages'] = [
      { role: 'system', content: toolInstruction },
      ...request.messages,
    ];
    const baseRequest: ChatRequest = {
      ...request,
      model: request.model || this.defaultModel,
      streaming: false,
    };

    for (let attempt = 0; attempt < PerplexityChatProvider.MAX_TOOL_ITERATIONS; attempt += 1) {
      const response = await this.sendToolAwareRequest(conversation, baseRequest);
      const assistantContent = this.extractContent(
        response.choices?.[0]?.message?.content as ChatMessageOutput['content'],
      ).trim();

      if (!assistantContent) {
        return;
      }

      const parsedToolCall = this.tryParseToolInvocation(assistantContent);

      if (parsedToolCall) {
        const toolUse: ToolUse = {
          id: `use_dt_${Date.now()}`,
          name: parsedToolCall.tool,
          input: parsedToolCall.input,
        };
        const result = await onToolUse(toolUse);

        const toolResultContent = JSON.stringify({
          success: result.success,
          data: result.data ?? null,
          error: result.error ?? null,
        });

        conversation = [
          ...conversation,
          { role: 'assistant', content: assistantContent },
          { role: 'tool', content: toolResultContent },
        ];
        continue;
      }

      if (onTokenReceived) {
        onTokenReceived(assistantContent);
      }
      return;
    }

    throw new Error('Tool loop exceeded maximum iterations');
  }

  private buildToolInstruction(tools: ToolDefinition[]): string {
    const toolDescriptions = tools
      .map((tool) => {
        const params =
          tool.input_schema?.properties && Object.keys(tool.input_schema.properties).length > 0
            ? JSON.stringify(tool.input_schema.properties, null, 2)
            : '{}';
        return `Tool: ${tool.name}\nDescription: ${tool.description}\nParameters: ${params}`;
      })
      .join('\n\n');

    return [
      'You can inspect project files using special tools.',
      'When you need to use a tool, respond ONLY with JSON using this shape:',
      '{"tool":"tool_name","input":{...}}',
      'After you receive tool results, continue the conversation normally.',
      toolDescriptions ? `Available tools:\n\n${toolDescriptions}` : 'No tools available.',
    ].join('\n\n');
  }

  private async sendToolAwareRequest(
    messages: ChatRequest['messages'],
    request: ChatRequest,
  ): Promise<ChatCompletionLike> {
    const requestForSend: ChatRequest = {
      ...request,
      messages,
      streaming: false,
      model: request.model || this.defaultModel,
    };
    const perplexityRequest = PerplexityAIConverter.toPerplexityRequest(requestForSend);
    const nonStreamingRequest: PerplexityChatRequestNonStreaming = {
      ...(perplexityRequest as PerplexityChatRequestNonStreaming),
      stream: false,
    };
    const completion = (await this.client.chat.completions.create(
      nonStreamingRequest,
    )) as unknown as ChatCompletionLike;
    return completion;
  }

  private tryParseToolInvocation(
    content: string,
  ): { tool: string; input: Record<string, unknown> } | null {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed) as {
        tool?: unknown;
        input?: unknown;
      };

      if (
        typeof parsed.tool === 'string' &&
        parsed.tool.length > 0 &&
        parsed.input &&
        typeof parsed.input === 'object'
      ) {
        return {
          tool: parsed.tool,
          input: parsed.input as Record<string, unknown>,
        };
      }
    } catch {
      return null;
    }

    return null;
  }
}
