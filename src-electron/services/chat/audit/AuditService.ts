import type { ChatAuditData, AuditConfig } from './AuditTypes.js';
import { TokenAccumulator } from './TokenAccumulator.js';
import type { ChatMessage, ChatRequest } from '../interfaces/ChatMessage.js';

/**
 * Service for auditing chat interactions across all providers
 */
export class AuditService {
  private static instance: AuditService;
  private config: AuditConfig;
  private auditLogs: ChatAuditData[] = [];

  private constructor(config: AuditConfig) {
    this.config = {
      logToConsole: true,
      logToServer: false,
      includePromptText: true,
      includeResponseText: true,
      ...config,
    };
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(config?: AuditConfig): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService(config || { enabled: true });
    }
    return AuditService.instance;
  }

  /**
   * Create an accumulator for tracking a chat request
   */
  public createAccumulator(
    provider: string,
    model: string,
    messages: ChatMessage[],
    onTokenReceived?: (token: string) => void,
  ): TokenAccumulator {
    return new TokenAccumulator(
      provider,
      model,
      messages,
      (auditData) => this.logChatAudit(auditData),
      onTokenReceived,
    );
  }

  /**
   * Create a wrapped token callback that accumulates tokens
   */
  public createWrappedCallback(
    request: ChatRequest,
    provider: string,
    onTokenReceived?: (token: string) => void,
  ): {
    callback: (token: string) => void;
    complete: (error?: unknown) => ChatAuditData | null;
  } {
    const accumulator = this.createAccumulator(
      provider,
      request.model,
      request.messages,
      onTokenReceived,
    );
    let auditData: ChatAuditData | null = null;

    return {
      callback: (token: string) => accumulator.handleToken(token),
      complete: (error?: unknown) => {
        auditData = accumulator.complete(error);
        return auditData;
      },
    };
  }

  /**
   * Log the chat audit data
   */
  public logChatAudit(auditData: ChatAuditData): void {
    if (!this.config.enabled) return;

    // Store audit data
    this.auditLogs.push(auditData);

    // Apply privacy filtering if needed
    const filteredData = this.applyPrivacyFilters(auditData);

    // Log to console
    if (this.config.logToConsole) {
      console.log(
        `[AUDIT] Chat completed: ${filteredData.provider}/${filteredData.model} (${filteredData.totalDuration}ms)`,
        filteredData,
      );
    }

    // Send to server endpoint
    if (this.config.logToServer && this.config.serverEndpoint) {
      void this.sendToServer(filteredData, this.config.serverEndpoint);
    }
  }

  /**
   * Get all accumulated audit logs
   */
  public getAuditLogs(): ChatAuditData[] {
    return [...this.auditLogs];
  }

  /**
   * Apply privacy filters to the audit data
   */
  private applyPrivacyFilters(auditData: ChatAuditData): ChatAuditData {
    const filteredData = { ...auditData };

    if (!this.config.includePromptText) {
      filteredData.promptText = '[REDACTED]';
    }

    if (!this.config.includeResponseText) {
      filteredData.completeResponse = '[REDACTED]';
    }

    return filteredData;
  }

  /**
   * Send audit data to a server endpoint
   */
  private async sendToServer(auditData: ChatAuditData, endpoint: string): Promise<void> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(auditData),
      });

      if (!response.ok) {
        console.error(
          `Failed to send audit data to server: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      console.error('Error sending audit data to server:', error);
    }
  }
}
