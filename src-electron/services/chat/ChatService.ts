import type { IChatProvider, ToolUse } from './interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from './interfaces/ChatMessage.js';
import {
  ChatProviderFactory,
  ProviderType,
  type ProviderConfig,
} from './factories/ChatProviderFactory.js';
import { AuditService } from './audit/AuditService.js';
import { FileToolsService, type ToolResult } from '../file-tools.service.js';
import log from 'electron-log';

interface ToolUseNotification {
  toolCallId: string;
  stage: 'start' | 'complete';
  result?: ToolResult;
}

/**
 * Main service class that provides a unified interface for chat functionality
 * across different providers
 */
export class ChatService {
  private provider: IChatProvider;
  private providerType: ProviderType;
  private config: ProviderConfig;
  private auditService: AuditService;
  private fileToolsService: FileToolsService;

  /**
   * Create a ChatService with the specified provider and configuration
   */
  constructor(
    providerType: string,
    config: ProviderConfig,
    enableAudit: boolean = true,
    allowedPaths?: string[],
  ) {
    this.providerType = providerType as ProviderType;
    this.config = config;
    this.provider = this.initializeProvider();
    this.auditService = AuditService.getInstance({
      enabled: enableAudit,
      logToConsole: true,
      logToServer: false,
    });
    this.fileToolsService = new FileToolsService(undefined, allowedPaths);
  }

  /**
   * Initialize the appropriate provider based on provider type
   */
  private initializeProvider(): IChatProvider {
    return ChatProviderFactory.createProvider(this.providerType, this.config);
  }

  /**
   * Send a chat request and handle streaming response
   */
  public async chat(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    // Create audit wrapper if audit is enabled
    const { callback, complete } = this.auditService.createWrappedCallback(
      request,
      this.providerType,
      onTokenReceived,
    );

    try {
      // Use the wrapped callback for provider calls
      await this.provider.chat(request, callback);
      complete();
    } catch (error) {
      complete(error);
      throw error;
    }
  }

  /**
   * Send a chat request with additional options and handle streaming response
   */
  public async chatWithOptions(
    request: ChatRequestWithOptions,
    onTokenReceived?: (token: string) => void,
  ): Promise<void> {
    // Create audit wrapper if audit is enabled
    const { callback, complete } = this.auditService.createWrappedCallback(
      request,
      this.providerType,
      onTokenReceived,
    );

    try {
      // Use the wrapped callback for provider calls
      await this.provider.chatWithOptions(request, callback);
      complete();
    } catch (error) {
      complete(error);
      throw error;
    }
  }

  /**
   * Get the audit logs for this chat service
   */
  public getAuditLogs(): ReturnType<typeof this.auditService.getAuditLogs> {
    return this.auditService.getAuditLogs();
  }

  /**
   * Send chat with file tools enabled
   * Automatically handles tool execution lifecycle and falls back to regular chat
   * if the provider doesn't support tools
   * @param request The chat request containing messages and model
   * @param onTokenReceived Callback function to handle streamed tokens
   * @param onToolUse Callback to notify when LLM uses a tool
   */
  public async chatWithFileTools(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
    onToolUse?: (
      toolName: string,
      input: unknown,
      notification?: ToolUseNotification,
    ) => void,
  ): Promise<void> {
    // Check if provider supports tools
    if (
      !this.provider.supportsTools ||
      !this.provider.supportsTools() ||
      !this.provider.chatWithTools
    ) {
      log.warn('[ChatService] Provider does not support tools, falling back to regular chat');
      return this.chat(request, onTokenReceived);
    }

    const tools = this.fileToolsService.getToolDefinitions();

    const handleToolUse = async (toolUse: ToolUse): Promise<ToolResult> => {
      if (onToolUse) {
        onToolUse(toolUse.name, toolUse.input, {
          stage: 'start',
          toolCallId: toolUse.id,
        });
      }

      const result = await this.fileToolsService.executeTool(toolUse.name, toolUse.input);

      if (onToolUse) {
        onToolUse(toolUse.name, toolUse.input, {
          stage: 'complete',
          toolCallId: toolUse.id,
          result,
        });
      }

      return result;
    };

    const { callback, complete } = this.auditService.createWrappedCallback(
      request,
      this.providerType,
      onTokenReceived,
    );

    try {
      await this.provider.chatWithTools(request, tools, callback, handleToolUse);
      complete();
    } catch (error) {
      complete(error);
      throw error;
    }
  }

  /**
   * Set the working directory for file tools operations
   * @param dir The directory path to set as working directory
   */
  public setFileToolsWorkingDirectory(dir: string): void {
    this.fileToolsService.setWorkingDirectory(dir);
  }

  /**
   * Set allowed paths for file tools operations
   * @param paths Array of allowed paths
   */
  public setFileToolsAllowedPaths(paths: string[]): void {
    this.fileToolsService.setAllowedPaths(paths);
  }
}
