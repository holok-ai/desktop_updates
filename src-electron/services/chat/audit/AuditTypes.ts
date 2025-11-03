/**
 * Core audit data interface for chat interactions
 */
export interface ChatAuditData {
    // Identifiers
    requestId: string;
    provider: string;
    model: string;
    
    // Timestamps and duration
    requestTimestamp: number;
    firstTokenTimestamp?: number;
    completionTimestamp: number;
    totalDuration: number;
    timeToFirstToken?: number;
    
    // Token metrics
    promptTokenCount?: number;
    completionTokenCount?: number;
    totalTokenCount?: number;
    tokensPerSecond?: number;
    
    // Content
    promptText: string;
    completeResponse: string;
    
    // Status
    success: boolean;
    error?: string;
    
    // Additional metadata
    metadata?: Record<string, unknown>;
}

/**
 * Provider-specific implementation for token counting
 */
export interface TokenCounter {
    countPromptTokens(messages: unknown[]): number;
    estimateResponseTokens(text: string): number;
}

/**
 * Configuration for the audit service
 */
export interface AuditConfig {
    enabled: boolean;
    logToConsole?: boolean;
    logToServer?: boolean;
    serverEndpoint?: string;
    includePromptText?: boolean;
    includeResponseText?: boolean;
}