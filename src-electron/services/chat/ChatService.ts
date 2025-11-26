import type { IChatProvider, ToolUse } from './interfaces/IChatProvider.js';
import type { ChatMessage, ChatRequest, ChatRequestWithOptions } from './interfaces/ChatMessage.js';
import {
  ChatProviderFactory,
  ProviderType,
  type ProviderConfig,
} from './factories/ChatProviderFactory.js';
import { AuditService } from './audit/AuditService.js';
import { FileToolsService, type ToolResult } from '../file-tools.service.js';
import { threadRepository } from '../../repository/thread-repository.js';
import log from 'electron-log';

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
  constructor(providerType: string, config: ProviderConfig, enableAudit: boolean = true) {
    this.providerType = providerType as ProviderType;
    this.config = config;
    this.provider = this.initializeProvider();
    this.auditService = AuditService.getInstance({
      enabled: enableAudit,
      logToConsole: true,
      logToServer: false,
    });
    this.fileToolsService = new FileToolsService();
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
    const requestWithContext = this.prepareRequest(request);

    // Create audit wrapper if audit is enabled
    const { callback, complete } = this.auditService.createWrappedCallback(
      requestWithContext,
      this.providerType,
      onTokenReceived,
    );

    try {
      // Use the wrapped callback for provider calls
      await this.provider.chat(requestWithContext, callback);
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
    const requestWithContext = this.prepareRequest(request);

    // Create audit wrapper if audit is enabled
    const { callback, complete } = this.auditService.createWrappedCallback(
      requestWithContext,
      this.providerType,
      onTokenReceived,
    );

    try {
      // Use the wrapped callback for provider calls
      await this.provider.chatWithOptions(requestWithContext, callback);
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
    onToolUse?: (toolName: string, input: unknown) => void,
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
        onToolUse(toolUse.name, toolUse.input);
      }
      return await this.fileToolsService.executeTool(toolUse.name, toolUse.input);
    };

    const requestWithContext = this.prepareRequest(request);
    const { callback, complete } = this.auditService.createWrappedCallback(
      requestWithContext,
      this.providerType,
      onTokenReceived,
    );

    try {
      await this.provider.chatWithTools(requestWithContext, tools, callback, handleToolUse);
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
   * Merge stored thread history with the incoming request to build provider context
   */
  private prepareRequest<T extends ChatRequest | ChatRequestWithOptions>(request: T): T {
    const threadId = this.extractThreadId(request);
    if (!threadId) {
      return request;
    }

    const history = this.getOrderedThreadMessages(threadId);
    if (!history.length) {
      return { ...request, threadId };
    }

    const mergedMessages = this.mergeMessages(history, request.messages);
    return {
      ...request,
      threadId,
      messages: mergedMessages,
    };
  }

  private extractThreadId(request: Partial<Pick<ChatRequest, 'threadId'>>): string | undefined {
    if (typeof request.threadId === 'string' && request.threadId.length > 0) {
      return request.threadId;
    }
    const legacyThreadId = (request as { thread_id?: string }).thread_id;
    if (typeof legacyThreadId === 'string' && legacyThreadId.length > 0) {
      return legacyThreadId;
    }
    return undefined;
  }

  private getOrderedThreadMessages(threadId: string): ChatMessage[] {
    const thread = threadRepository.loadThread(threadId);
    if (!thread?.messages?.length) {
      return [];
    }

    return thread.messages
      .filter((message) => !message.deletedAt)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((message) => ({
        role: message.role,
        content: message.content,
        id: message.id,
        clientMessageId: message.clientMessageId,
      }));
  }

  private mergeMessages(history: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
    if (!incoming.length) {
      return history;
    }

    const merged = [...history];
    const seen = new Set<string>();

    for (const message of merged) {
      this.registerMessageIdentifiers(message, seen);
    }

    for (const message of incoming) {
      const idKey = this.getMessageKey(message, 'id');
      const clientKey = this.getMessageKey(message, 'client');

      if ((idKey && seen.has(idKey)) || (clientKey && seen.has(clientKey))) {
        continue;
      }

      this.registerMessageIdentifiers(message, seen);
      merged.push(message);
    }

    return merged;
  }

  private registerMessageIdentifiers(message: ChatMessage, seen: Set<string>): void {
    const idKey = this.getMessageKey(message, 'id');
    const clientKey = this.getMessageKey(message, 'client');

    if (idKey) {
      seen.add(idKey);
    }

    if (clientKey) {
      seen.add(clientKey);
    }
  }

  private getMessageKey(message: ChatMessage, type: 'id' | 'client'): string | null {
    if (type === 'id' && typeof message.id === 'string' && message.id.length > 0) {
      return `id:${message.id}`;
    }

    if (
      type === 'client' &&
      typeof message.clientMessageId === 'string' &&
      message.clientMessageId.length > 0
    ) {
      return `client:${message.clientMessageId}`;
    }

    return null;
  }
}
