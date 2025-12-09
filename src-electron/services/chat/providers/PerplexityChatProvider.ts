import Perplexity from '@perplexity-ai/perplexity_ai';
import type PerplexityClient from '@perplexity-ai/perplexity_ai';
import type { ToolDefinition, ToolResult } from '../../file-tools.service.js';
import {
  buildToolInstructionPrompt,
  formatToolDescriptions,
} from '../utils/toolInstruction.js';
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

      // Filter out any tool call JSON that might be in the response
      const cleanedContent = this.removeToolCallJson(assistantContent);

      if (onTokenReceived && cleanedContent) {
        onTokenReceived(cleanedContent);
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

  private removeToolCallJson(content: string): string {
    if (!content || !content.trim()) {
      return content;
    }

    // Try to parse the entire content as a tool call first
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as { tool?: unknown; input?: unknown; [key: string]: unknown };
        if (typeof parsed.tool === 'string') {
          // Check if it's a tool call in either format
          const hasInput = parsed.input && typeof parsed.input === 'object';
          const hasToolParams = Object.keys(parsed).some(key => key !== 'tool' && ['path', 'content', 'overwrite', 'encoding', 'folder', 'recursive'].includes(key));
          if (hasInput || hasToolParams) {
            // Entire content is a tool call, return empty
            return '';
          }
        }
      } catch {
        // Not valid JSON, continue
      }
    }

    // Remove tool call JSON patterns that might be embedded in the text
    // Match {"tool":"...","input":{...}} or {"tool":"...","path":"...",...} with nested objects
    // eslint-disable-next-line security/detect-unsafe-regex
    const toolCallPattern = /\{\s*"tool"\s*:\s*"[^"]+"\s*(?:,\s*"input"\s*:\s*\{[^}]*(\{[^}]*\}[^}]*)*\}|\s*,\s*"[^"]+"\s*:[^}]*)\s*\}/g;
    let cleaned = content.replace(toolCallPattern, '').trim();
    
    // Also check each line for tool call JSON
    const lines = cleaned.split('\n');
    const filteredLines = lines.filter((line) => {
      const lineTrimmed = line.trim();
      if (!lineTrimmed.startsWith('{') || !lineTrimmed.endsWith('}')) {
        return true;
      }
      try {
        const parsed = JSON.parse(lineTrimmed) as { tool?: unknown; input?: unknown; [key: string]: unknown };
        // If it looks like a tool call, filter it out
        if (typeof parsed.tool === 'string') {
          const hasInput = parsed.input && typeof parsed.input === 'object';
          const hasToolParams = Object.keys(parsed).some(key => key !== 'tool' && ['path', 'content', 'overwrite', 'encoding', 'folder', 'recursive'].includes(key));
          if (hasInput || hasToolParams) {
            return false;
          }
        }
      } catch {
        // Not JSON, keep it
      }
      return true;
    });
    
    return filteredLines.join('\n').trim();
  }

  private formatToolResult(toolName: string, result: ToolResult): string {
    if (!result.success) {
      const error = result.error || 'Unknown error occurred';

      // Format FILE_EXISTS error in a user-friendly way
      if (error.startsWith('FILE_EXISTS:')) {
        const match = error.match(/FILE_EXISTS:\s*'([^']+)'/);
        const filePath = match ? match[1] : 'the file';
        return `TOOL FAILED - File already exists: ${filePath} already exists. To overwrite it, the user must say to overwrite it.`;
      }

      if (error.startsWith('ACCESS_DENIED:')) {
        return `TOOL FAILED - Access denied: ${error.replace('ACCESS_DENIED: ', '')}`;
      }

      if (error.startsWith('PERMISSION_DENIED:')) {
        return `TOOL FAILED - Permission denied: ${error.replace('PERMISSION_DENIED: ', '')}`;
      }

      return `TOOL FAILED - ${error}`;
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
          return `TOOL SUCCEEDED - File created successfully at ${filePath}.`;
        }
        return `TOOL SUCCEEDED - File updated successfully at ${filePath}.`;
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
