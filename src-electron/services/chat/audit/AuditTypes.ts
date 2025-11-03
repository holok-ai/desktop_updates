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

/**
 * Runtime helpers so this otherwise type-only module can be exercised by tests.
 */
export function makeAuditData(overrides?: Partial<ChatAuditData>): ChatAuditData {
  const now = Date.now();
  const base: ChatAuditData = {
    requestId: 'req_1',
    provider: 'provider',
    model: 'model',
    requestTimestamp: now,
    completionTimestamp: now + 10,
    totalDuration: 10,
    promptText: 'prompt',
    completeResponse: 'response',
    success: true,
  };

  return { ...base, ...(overrides ?? {}) } as ChatAuditData;
}

export function redactAuditData(
  a: ChatAuditData,
  options?: { includePrompt?: boolean; includeResponse?: boolean },
): ChatAuditData {
  const includePrompt = options?.includePrompt ?? false;
  const includeResponse = options?.includeResponse ?? false;

  return {
    ...a,
    promptText: includePrompt ? a.promptText : '[REDACTED]',
    completeResponse: includeResponse ? a.completeResponse : '[REDACTED]',
  };
}
