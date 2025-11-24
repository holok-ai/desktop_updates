import type { IChatProvider } from './interfaces/IChatProvider.js';
import type { ChatRequest, ChatRequestWithOptions } from './interfaces/ChatMessage.js';
import {
  ChatProviderFactory,
  ProviderType,
  type ProviderConfig,
} from './factories/ChatProviderFactory.js';
import { AuditService } from './audit/AuditService.js';

// Static UUID for testing thread_id association
const THREAD_UUID = '12345678-1234-5678-1234-567812345678';

/**
 * Main service class that provides a unified interface for chat functionality
 * across different providers
 */
export class ChatService {
  private provider: IChatProvider;
  private providerType: ProviderType;
  private config: ProviderConfig;
  private auditService: AuditService;

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
    // Add thread_id to request
    const requestWithThreadId = { ...request, thread_id: THREAD_UUID };

    // Create audit wrapper if audit is enabled
    const { callback, complete } = this.auditService.createWrappedCallback(
      requestWithThreadId,
      this.providerType,
      onTokenReceived,
    );

    try {
      // Use the wrapped callback for provider calls
      await this.provider.chat(requestWithThreadId, callback);
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
    // Add thread_id to request
    const requestWithThreadId = { ...request, thread_id: THREAD_UUID };

    // Create audit wrapper if audit is enabled
    const { callback, complete } = this.auditService.createWrappedCallback(
      requestWithThreadId,
      this.providerType,
      onTokenReceived,
    );

    try {
      // Use the wrapped callback for provider calls
      await this.provider.chatWithOptions(requestWithThreadId, callback);
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
}
