import Perplexity from '@perplexity-ai/perplexity_ai';
import type PerplexityClient from '@perplexity-ai/perplexity_ai';
import type { ToolDefinition, ToolResult } from '../../file-tools.service.js';
import { buildToolInstructionPrompt, formatToolDescriptions } from '../utils/toolInstruction.js';
import type { IChatProvider, ToolUse } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import {
  PerplexityAIConverter,
  type PerplexityChatRequest,
  type PerplexityChatRequestNonStreaming,
  type PerplexityChatRequestStreaming,
} from '../converters/PerplexityAIConverter.js';
import { ModelCapabilityService } from '../ModelCapabilityService.js';

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

    if (!defaultModel) {
      throw new Error('Model is required for PerplexityChatProvider');
    }
    this.defaultModel = defaultModel;
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
    const result = ModelCapabilityService.checkToolSupport(this.defaultModel, 'perplexity');
    return result.supported;
  }

  /**
   * Get the reason why tools are not supported (if applicable)
   */
  public getToolSupportError(): string | undefined {
    const result = ModelCapabilityService.checkToolSupport(this.defaultModel, 'perplexity');
    return result.reason;
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

      // If empty content, fall back to regular chat
      if (!assistantContent) {
        console.warn(
          '[PerplexityChatProvider] Empty response from tool-aware request, using fallback',
        );
        break;
      }

      const parsedToolCall = this.tryParseToolInvocation(assistantContent);

      if (parsedToolCall) {
        const toolUse: ToolUse = {
          id: `use_dt_${Date.now()}`,
          name: parsedToolCall.tool,
          input: parsedToolCall.input,
        };
        const result = await onToolUse(toolUse);

        const toolResultContent = this.formatToolResult(parsedToolCall.tool, result);

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

    // If we reach here, either:
    // 1. Empty response received
    // 2. Max iterations exceeded (all responses were tool calls)
    // Fall back to regular chat without tools
    console.warn(
      '[PerplexityChatProvider] Tool loop did not produce final response, falling back to regular chat',
    );
    await this.chat(request, onTokenReceived);
  }

  private buildToolInstruction(tools: ToolDefinition[]): string {
    const toolDescriptions = formatToolDescriptions(tools);
    return buildToolInstructionPrompt(toolDescriptions);
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
        [key: string]: unknown;
      };

      if (typeof parsed.tool !== 'string' || parsed.tool.length === 0) {
        return null;
      }

      // Handle standard format: {"tool": "...", "input": {...}}
      if (parsed.input && typeof parsed.input === 'object') {
        return {
          tool: parsed.tool,
          input: parsed.input as Record<string, unknown>,
        };
      }

      // Handle alternative format: {"tool": "...", "path": "...", "content": "...", ...}
      // Extract all properties except "tool" as the input
      const { tool: _tool, ...rest } = parsed;
      if (Object.keys(rest).length > 0) {
        return {
          tool: parsed.tool,
          input: rest as Record<string, unknown>,
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  private formatToolResult(toolName: string, result: ToolResult): string {
    if (!result.success) {
      const error = result.error || 'Unknown error occurred';

      // Format FILE_EXISTS error in a user-friendly way
      if (error.startsWith('FILE_EXISTS:')) {
        const match = error.match(/FILE_EXISTS:\s*'([^']+)'/);
        const filePath = match ? match[1] : 'the file';
        return `File already exists: ${filePath} already exists. To overwrite it, the user must say to overwrite it.`;
      }

      if (error.startsWith('ACCESS_DENIED:')) {
        return `Access denied: ${error.replace('ACCESS_DENIED: ', '')}`;
      }

      if (error.startsWith('PERMISSION_DENIED:')) {
        return `Permission denied: ${error.replace('PERMISSION_DENIED: ', '')}`;
      }

      return error;
    }

    switch (toolName) {
      case 'write_file': {
        const data = result.data as {
          path?: string;
          created?: boolean;
          bytesWritten?: number;
        };
        const filePath = data.path || 'unknown';
        if (data.created) {
          return `File created at ${filePath}`;
        }
        return `File updated at ${filePath}`;
      }
      case 'read_file': {
        // For read_file, return the actual file content
        return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
      }
      case 'read_folder': {
        // For read_folder, return the folder listing
        return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
      }
      default:
        return JSON.stringify({
          success: result.success,
          data: result.data ?? null,
          error: result.error ?? null,
        });
    }
  }
}
