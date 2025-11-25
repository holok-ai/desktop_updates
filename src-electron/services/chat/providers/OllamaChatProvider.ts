import { Ollama } from 'ollama';
import type { ChatRequest as OllamaChatRequest, ChatResponse } from 'ollama';
import type { IChatProvider } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import { OllamaConverter } from '../converters/OllamaConverter.js';
import type { ToolDefinition, ToolResult } from '../../file-tools.service.js';

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
    console.log('[OllamaChatProvider] Received non-streaming response:', JSON.stringify(response, null, 2));
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

      if (!assistantContent) {
        return;
      }

      const parsedToolCall = this.tryParseToolInvocation(assistantContent);

      if (parsedToolCall) {
        const toolUse: ToolUseRequest = {
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
