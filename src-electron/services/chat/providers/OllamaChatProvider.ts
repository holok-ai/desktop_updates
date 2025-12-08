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
        'You can inspect and modify project files using special tools.',
  
        'CRITICAL RULES:',
        '1. When user asks to create/read/modify a file, IMMEDIATELY call the tool - do NOT ask for permission first',
        '2. For file content: Generate the COMPLETE, ACTUAL content that should be written to the file',
        '   - CRITICAL: Put the FULL content in the "content" field of the tool call JSON, NOT in your response text',
        '   - Generate the actual content based on what the user requests - if they ask for specific content, include it all',
        '   - NEVER use placeholders like "...", "etc", or "and so on" in the "content" field',
        '   - The "content" field must contain the EXACT text that should be in the file',
        '   - Generate complete, usable content - do not summarize or truncate the actual content',
        '3. When you need to use a tool, respond ONLY with JSON in this shape:',
        '   {"tool": "tool_name", "input": { ... }}',
        '   Do not add any text outside this JSON.',
        '4. After calling a tool, you will receive a result starting with:',
        '   - "TOOL SUCCEEDED" - operation worked',
        '   - "TOOL FAILED" - operation failed',
        '',
        'Response rules after receiving tool result:',
        '1. CRITICAL: Only say "I\'ve created the file" if you see "TOOL SUCCEEDED"',
        '   - If you see "TOOL SUCCEEDED - File created successfully at [path]":',
        '     → Tell user: "I\'ve created the file [exact path from result]"',
        '   - If you see "TOOL FAILED", NEVER say the file was created',
        '2. If you see "TOOL FAILED - File already exists: [path] already exists":',
        '   → Tell user: "The file [exact path from result] already exists. Would you like me to overwrite it?"',
        '   → You MUST include the full file path in your response',
        '   → Do NOT just say "Would you like me to overwrite the file?" without mentioning which file',
        '   → Do NOT create the file again without user confirmation',
        '3. If you see any other "TOOL FAILED":',
        '   → Tell user exactly what failed (use exact error message)',
        '4. NEVER ask for permission before calling a tool',
        '5. NEVER say "Would you like me to proceed with creating" - just call the tool',
        '6. CRITICAL: NEVER include JSON in your response to the user',
        '   - Do NOT show {"tool": "...", "path": "...", "content": "..."}',
        '   - Do NOT show any JSON objects in your natural language response',
        '   - Your response must be ONLY natural language text',
        '7. Use EXACT file paths from tool results, never guess',
        '8. Respond in natural language (not JSON) after tool results',
        '9. Continue the conversation naturally after finishing the action',
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
      
      // Format other errors
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
