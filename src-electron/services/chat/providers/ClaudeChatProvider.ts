/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import Anthropic from '@anthropic-ai/sdk';
import type { IChatProvider, ToolUse } from '../interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from '../interfaces/ChatMessage.js';
import type { ToolDefinition, ToolResult } from '../../file-tools.service.js';
import { ClaudeConverter } from '../converters/ClaudeConverter.js';

type ClaudeTool = {
  name: string;
  description: string;
  input_schema: ToolDefinition['input_schema'];
};

type ToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type TextBlock = {
  type: 'text';
  text: string;
};

export class ClaudeChatProvider implements IChatProvider {
  private client: Anthropic;
  private defaultModel: string;
  private static readonly MAX_TOOL_ITERATIONS = 5;

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
    return true; // Claude natively supports tool calling
  }

  /**
   * Send a chat request with tools enabled
   */
  public async chatWithTools(
    request: ChatRequest,
    tools: ToolDefinition[],
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolUse: ToolUse) => Promise<ToolResult>,
  ): Promise<void> {
    if (!tools.length) {
      await this.chat(request, onTokenReceived);
      return;
    }

    if (!onToolUse) {
      console.warn('[ClaudeChatProvider] Tool handler missing, falling back to regular chat.');
      await this.chat(request, onTokenReceived);
      return;
    }

    const modelToUse = request.model || this.defaultModel;
    const claudeRequest = ClaudeConverter.toClaudeRequest({ ...request, model: modelToUse });
    const claudeTools = this.convertToolsToClaudeFormat(tools);

    try {
      await this.handleToolLoop(claudeRequest, claudeTools, onTokenReceived, onToolUse, request);
    } catch (error) {
      console.error('[ClaudeChatProvider] Tool-enabled chat failed:', error);
      throw error;
    }
  }

  /**
   * Convert ToolDefinition to Claude's tool format
   */
  private convertToolsToClaudeFormat(tools: ToolDefinition[]): ClaudeTool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));
  }

  /**
   * Extract tool_use blocks from response content
   */
  private extractToolUses(content: any[]): ToolUseBlock[] {
    return content.filter((block: any): block is ToolUseBlock => block.type === 'tool_use');
  }

  /**
   * Extract text blocks from response content
   */
  private extractTextContent(content: any[]): string {
    return content
      .filter((block: any): block is TextBlock => block.type === 'text')
      .map((block: TextBlock) => block.text)
      .join('');
  }

  /**
   * Format tool results for Claude API
   */
  private formatToolResults(
    toolUseBlocks: ToolUseBlock[],
    results: ToolResult[],
  ): Array<{ type: 'tool_result'; tool_use_id: string; content: string }> {
    return toolUseBlocks.map((toolUse, index) => ({
      type: 'tool_result' as const,
      tool_use_id: toolUse.id,
      content: JSON.stringify({
        success: results[index].success,
        data: results[index].data ?? null,
        error: results[index].error ?? null,
      }),
    }));
  }

  /**
   * Handle the tool use loop for both streaming and non-streaming modes
   */
  private async handleToolLoop(
    claudeRequest: { model: string; messages: any[]; stream: boolean },
    tools: ClaudeTool[],
    onTokenReceived: ((token: string) => void) | undefined,
    onToolUse: (toolUse: ToolUse) => Promise<ToolResult>,
    originalRequest: ChatRequest,
  ): Promise<void> {
    let messages = claudeRequest.messages;
    const shouldStream = originalRequest.streaming !== false;

    for (let iteration = 0; iteration < ClaudeChatProvider.MAX_TOOL_ITERATIONS; iteration++) {
      let response: any;

      if (shouldStream) {
        response = await this.sendStreamingRequestWithTools(
          claudeRequest.model,
          messages,
          tools,
          onTokenReceived,
          originalRequest,
        );
      } else {
        response = await this.sendNonStreamingRequestWithTools(
          claudeRequest.model,
          messages,
          tools,
          onTokenReceived,
          originalRequest,
        );
      }

      if (!response || !response.content) {
        return;
      }

      // Extract tool uses from response
      const toolUseBlocks = this.extractToolUses(response.content);

      // If no tool uses, we're done - text has already been sent via onTokenReceived
      if (toolUseBlocks.length === 0) {
        return;
      }

      // Execute all tools
      const toolResults: ToolResult[] = [];
      for (const toolUseBlock of toolUseBlocks) {
        const toolUseRequest: ToolUse = {
          id: toolUseBlock.id,
          name: toolUseBlock.name,
          input: toolUseBlock.input,
        };
        const result = await onToolUse(toolUseRequest);
        toolResults.push(result);
      }

      // Format tool results
      const toolResultBlocks = this.formatToolResults(toolUseBlocks, toolResults);

      // Append assistant message and tool results to conversation
      messages = [
        ...messages,
        {
          role: 'assistant',
          content: response.content,
        },
        {
          role: 'user',
          content: toolResultBlocks,
        },
      ];
    }

    throw new Error('Tool loop exceeded maximum iterations');
  }

  /**
   * Send streaming request with tools
   */
  private async sendStreamingRequestWithTools(
    model: string,
    messages: any[],
    tools: ClaudeTool[],
    onTokenReceived: ((token: string) => void) | undefined,
    originalRequest: ChatRequest,
  ): Promise<any> {
    const stream = this.client.messages
      .stream({
        model,
        messages,
        tools: tools as any,
        max_tokens: 4096,
        stream: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        thread_id: (originalRequest as any).thread_id,
      } as any)
      .on('text', (text) => {
        if (onTokenReceived) {
          onTokenReceived(text);
        }
      });

    const finalMessage = await stream.finalMessage();
    return finalMessage;
  }

  /**
   * Send non-streaming request with tools
   */
  private async sendNonStreamingRequestWithTools(
    model: string,
    messages: any[],
    tools: ClaudeTool[],
    onTokenReceived: ((token: string) => void) | undefined,
    originalRequest: ChatRequest,
  ): Promise<any> {
    const response = await this.client.messages.create({
      model,
      messages,
      tools: tools as any,
      max_tokens: 4096,
      stream: false,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      thread_id: (originalRequest as any).thread_id,
    } as any);

    // Send text content if callback provided
    if (onTokenReceived && response.content) {
      const textContent = this.extractTextContent(response.content);
      if (textContent) {
        onTokenReceived(textContent);
      }
    }

    return response;
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
