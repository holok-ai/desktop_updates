import type { IChatProvider, ToolUse } from './interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from './interfaces/ChatMessage.js';
import {
  ChatProviderFactory,
  ProviderType,
  type ProviderConfig,
} from './factories/ChatProviderFactory.js';
import { AuditService } from './audit/AuditService.js';
import {
  FileToolsService,
  type ToolResult,
  type ToolStatusCallback,
} from '../file-tools.service.js';
import log from 'electron-log';

export interface ToolUseNotification {
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
   * Returns the requestId from the audit service for linking to message creation
   * The requestId is generated when the audit wrapper is created, so it's available immediately
   */
  public async chat(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
  ): Promise<{ requestId: string | null }> {
    // Create audit wrapper if audit is enabled
    // The requestId is generated immediately when the accumulator is created
    const { callback, complete, getRequestId } = this.auditService.createWrappedCallback(
      request,
      this.providerType,
      onTokenReceived,
    );

    // Get requestId immediately (it's generated when accumulator is created)
    const requestId = getRequestId();

    try {
      // Use the wrapped callback for provider calls
      await this.provider.chat(request, callback);
      complete();
      return { requestId };
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
   * Set callback for tool status updates (for UI feedback during long operations)
   * @param callback - Function to call when tool status changes
   */
  public setToolStatusCallback(callback: ToolStatusCallback | null): void {
    this.fileToolsService.setStatusCallback(callback);
  }

  /**
   * Send chat with file tools enabled
   * Automatically handles tool execution lifecycle and falls back to regular chat
   * if the provider doesn't support tools
   * @param request The chat request containing messages and model
   * @param onTokenReceived Callback function to handle streamed tokens
   * @param onToolUse Callback to notify when LLM uses a tool
   * @param onToolStatus Callback to notify about tool execution status (for UI feedback)
   * @param onRequestId Callback to notify when requestId is generated (before LLM call starts)
   */
  public async chatWithFileTools(
    request: ChatRequest,
    onTokenReceived?: (token: string) => void,
    onToolUse?: (toolName: string, input: unknown, notification?: ToolUseNotification) => void,
    onToolStatus?: ToolStatusCallback,
    onRequestId?: (requestId: string) => void,
  ): Promise<{ requestId: string | null }> {
    // Generate requestId FIRST, before any LLM call (including fallback)
    // This ensures the frontend can create the user message with requestId immediately
    const { callback, complete, getRequestId } = this.auditService.createWrappedCallback(
      request,
      this.providerType,
      onTokenReceived,
    );
    const requestId = getRequestId();
    log.info('[ChatService] chatWithFileTools - requestId generated:', requestId, 'onRequestId callback:', onRequestId ? 'YES' : 'NO');
    
    // Notify about requestId immediately (before LLM call starts)
    if (requestId && onRequestId) {
      log.info('[ChatService] Sending requestId to frontend:', requestId);
      onRequestId(requestId);
    } else {
      log.warn('[ChatService] Cannot send requestId - requestId:', requestId, 'onRequestId:', onRequestId ? 'defined' : 'undefined');
    }

    // Set up status callback for this request
    if (onToolStatus) {
      this.fileToolsService.setStatusCallback(onToolStatus);
    }
    // Check if provider supports tools
    if (
      !this.provider.supportsTools ||
      !this.provider.supportsTools() ||
      !this.provider.chatWithTools
    ) {
      // Get friendly error message if available
      const errorMessage =
        this.provider.getToolSupportError?.() || 'This model does not support tool calling.';

      log.warn(
        '[ChatService] Provider does not support tools, falling back to regular chat:',
        errorMessage,
      );

      // Fall back to regular chat - use the already created wrapper
      try {
        await this.provider.chat(request, callback);
        complete();
        return { requestId };
      } catch (error) {
        complete(error);
        throw error;
      }
    }

    const tools = this.fileToolsService.getToolDefinitions();

    const handleToolUse = async (toolUse: ToolUse): Promise<ToolResult> => {
      if (onToolUse) {
        onToolUse(toolUse.name, toolUse.input, {
          stage: 'start',
          toolCallId: toolUse.id,
        });
      }

      let result: ToolResult;
      try {
        result = await this.fileToolsService.executeTool(toolUse.name, toolUse.input);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.error('[ChatService] executeTool failed', { tool: toolUse.name, error: message });
        result = { success: false, error: message };
      }

      if (onToolUse) {
        onToolUse(toolUse.name, toolUse.input, {
          stage: 'complete',
          toolCallId: toolUse.id,
          result,
        });
      }

      return result;
    };

    // Use the wrapper created at the start (with requestId already sent to frontend)
    try {
      await this.provider.chatWithTools(request, tools, callback, handleToolUse);
      complete();
      return { requestId };
    } catch (error) {
      complete(error);
      throw error;
    } finally {
      // Clear status callback after request completes
      if (onToolStatus) {
        this.fileToolsService.setStatusCallback(null);
      }
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
