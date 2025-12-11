import { Ollama } from 'ollama';
import type { ChatRequest as OllamaChatRequest, ChatResponse } from 'ollama';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import { OllamaConverter } from '../converters/OllamaConverter.js';
import type { ToolDefinition, ToolResult } from '../../file-tools.service.js';
import { buildToolInstructionPrompt, formatToolDescriptions } from '../utils/toolInstruction.js';

type ToolUseRequest = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export class OllamaChatProvider implements IChatProvider {
  private ollama: Ollama;
  private defaultModel: string;
  private toolSupportEnabled = true;
  private static readonly MAX_TOOL_ITERATIONS = 5;

  constructor(apiEndpoint: string, apiKey: string | undefined, defaultModel: string) {
    const clientOptions: ConstructorParameters<typeof Ollama>[0] = {
      host: apiEndpoint,
    };

    if (apiKey) {
      clientOptions.headers = {
        'X-api-key': apiKey,
      };
    }

    this.ollama = new Ollama(clientOptions);
    this.defaultModel = defaultModel;
    console.log(
      `[OllamaChatProvider] endpoint=${apiEndpoint} model=${defaultModel} hasKey=${Boolean(apiKey)}`,
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

    await this.executeChatRequest(ollamaRequest, onTokenReceived);
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

    await this.executeChatRequest(ollamaRequest, onTokenReceived);
  }

  public supportsTools(): boolean {
    return this.toolSupportEnabled;
  }

  public async chatWithTools(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolUse: ToolUseRequest) => Promise<ToolResult>,
  ): Promise<void> {
    if (!tools.length) {
      await this.chat(request, onTokenReceived);
      return;
    }

    if (!this.toolSupportEnabled) {
      await this.fallbackToStandardChat(request, onTokenReceived);
      return;
    }

    if (!onToolUse) {
      console.warn('[OllamaChatProvider] Tool handler missing, falling back to regular chat.');
      await this.fallbackToStandardChat(request, onTokenReceived);
      return;
    }

    try {
      await this.handleToolLoop(request, tools, onTokenReceived, onToolUse);
    } catch (error) {
      console.warn('[OllamaChatProvider] Tool-enabled chat failed. Disabling tool support.', error);
      this.toolSupportEnabled = false;
      await this.fallbackToStandardChat(request, onTokenReceived);
    }
  }

  private async executeChatRequest(
    ollamaRequest: OllamaChatRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    if (ollamaRequest.stream) {
      const streamingRequest: OllamaChatRequest & { stream: true } = {
        ...ollamaRequest,
        stream: true,
      };
      const response = await this.ollama.chat(streamingRequest);
      await this.processStreamingResponse(response, onTokenReceived);
      return;
    }

    const nonStreamingRequest: OllamaChatRequest & { stream: false } = {
      ...ollamaRequest,
      stream: false,
    };
    const response: ChatResponse = await this.ollama.chat(nonStreamingRequest);
    console.log(
      '[OllamaChatProvider] Received non-streaming response:',
      JSON.stringify(response, null, 2),
    );
    this.emitNonStreamingResponse(response, onTokenReceived);
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
        console.error(
          '[OllamaChatProvider] Unexpected response structure - missing message:',
          part,
        );
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

  private async fallbackToStandardChat(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    await this.chat(request, onTokenReceived);
  }

  private async handleToolLoop(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived: ((token: string) => void) | undefined,
    onToolUse: (toolUse: ToolUseRequest) => Promise<ToolResult>,
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

    for (let attempt = 0; attempt < OllamaChatProvider.MAX_TOOL_ITERATIONS; attempt += 1) {
      const response = await this.sendToolAwareRequest(conversation, baseRequest);
      const assistantContent = response.message?.content?.trim();

      // If empty content, try a regular fallback response
      if (!assistantContent) {
        console.warn('[OllamaChatProvider] Empty response from tool-aware request, using fallback');
        break;
      }

      const parsedToolCall = this.tryParseToolInvocation(assistantContent);

      if (parsedToolCall) {
        const toolUse: ToolUseRequest = {
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
      '[OllamaChatProvider] Tool loop did not produce final response, falling back to regular chat',
    );
    await this.fallbackToStandardChat(request, onTokenReceived);
  }

  private buildToolInstruction(tools: ToolDefinition[]): string {
    const toolDescriptions = formatToolDescriptions(tools);
    return buildToolInstructionPrompt(toolDescriptions);
  }

  private async sendToolAwareRequest(
    messages: ChatRequest['messages'],
    request: ChatRequest,
  ): Promise<ChatResponse> {
    const requestForSend: ChatRequest = {
      ...request,
      messages,
      streaming: false,
      model: request.model || this.defaultModel,
    };
    const ollamaRequest = OllamaConverter.toOllamaRequest(requestForSend);
    const nonStreamingRequest: OllamaChatRequest & { stream: false } = {
      ...ollamaRequest,
      stream: false,
    };
    return this.ollama.chat(nonStreamingRequest);
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

      // Format other errors
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
