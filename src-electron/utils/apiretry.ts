/**
 * API Retry Utility
 * Provides exponential backoff retry logic for transient failures
 * Used across all Moku API domains (Projects, Threads, Models, etc.)
 * EXCLUDES Authentication endpoints (as per E3-S1 AC-10)
 */

import log from 'electron-log';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** HTTP status codes that should trigger retry */
  retryableStatuses: number[];
  /** Network error codes that should trigger retry */
  retryableErrorCodes: string[];
  /** Whether to add jitter to prevent thundering herd */
  useJitter: boolean;
}

/**
 * Default retry configuration for Moku API calls
 * Based on E3-S1 AC-10: 3 attempts with exponential backoff (1s, 2s, 4s)
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 4000, // 4 seconds
  retryableStatuses: [
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
  ],
  retryableErrorCodes: [
    'ECONNRESET', // Connection reset
    'ETIMEDOUT', // Connection timed out
    'ENOTFOUND', // DNS lookup failed
    'ECONNREFUSED', // Connection refused
    'ENETUNREACH', // Network unreachable
  ],
  useJitter: true,
};

/**
 * Error wrapper for failed operations after all retries exhausted
 */
export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error,
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

/**
 * Check if an error is retryable based on configuration
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (!error) return false;

  // Check for HTTP response errors
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return config.retryableStatuses.includes(error.status);
  }

  // Check for network errors
  if (error instanceof Error) {
    const errorCode = (error as { code?: string }).code;
    if (errorCode && config.retryableErrorCodes.includes(errorCode)) {
      return true;
    }

    // Check error message for network-related failures
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('fetch failed')
    );
  }

  return false;
}

/**
 * Calculate delay for next retry attempt with exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = Math.min(
    config.baseDelayMs * Math.pow(2, attempt - 1),
    config.maxDelayMs,
  );

  // Add jitter to prevent thundering herd (±25% of delay)
  if (config.useJitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
    return Math.floor(exponentialDelay * jitterFactor);
  }

  return exponentialDelay;
}

/**
 * Sleep for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * API Retry utilities
 * Provides exponential backoff retry logic for API calls
 */
export const ApiRetry = {
  /**
   * Retry a function with exponential backoff
   *
   * @param fn - Async function to retry
   * @param config - Retry configuration (defaults to DEFAULT_RETRY_CONFIG)
   * @param context - Optional context for logging (e.g., 'ProjectService.create')
   * @returns Result of the function
   * @throws RetryExhaustedError if all retries fail
   *
   * @example
   * ```typescript
   * const result = await ApiRetry.execute(
   *   () => fetch('https://api.example.com/data'),
   *   DEFAULT_RETRY_CONFIG,
   *   'fetchData'
   * );
   * ```
   */
  execute: async function <T>(
    fn: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    context?: string,
  ): Promise<T> {
    let lastError: Error | null = null;
    const logPrefix = context ? `[ApiRetry:${context}]` : '[ApiRetry]';

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        log.debug(`${logPrefix} Attempt ${attempt}/${config.maxAttempts}`);

        const result = await fn();

        // Success!
        if (attempt > 1) {
          log.info(`${logPrefix} Succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isRetryable = isRetryableError(error, config);

        if (!isRetryable) {
          log.debug(`${logPrefix} Non-retryable error, failing immediately:`, lastError.message);
          throw lastError;
        }

        // Last attempt - don't delay, just throw
        if (attempt === config.maxAttempts) {
          log.error(
            `${logPrefix} All ${config.maxAttempts} attempts failed:`,
            lastError.message,
          );
          throw new RetryExhaustedError(
            `Operation failed after ${config.maxAttempts} attempts: ${lastError.message}`,
            config.maxAttempts,
            lastError,
          );
        }

        // Calculate delay and wait before next attempt
        const delayMs = calculateDelay(attempt, config);
        log.warn(
          `${logPrefix} Attempt ${attempt} failed (${lastError.message}), retrying in ${delayMs}ms...`,
        );

        await delay(delayMs);
      }
    }

    // Should never reach here, but TypeScript doesn't know that
    throw new RetryExhaustedError(
      'Unexpected: retry loop completed without result',
      config.maxAttempts,
      lastError || new Error('Unknown error'),
    );
  },
};

/**
 * Convenience function for backward compatibility
 * @deprecated Use ApiRetry.execute() instead
 */
export const withRetry = <T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: string,
): Promise<T> => ApiRetry.execute(fn, config, context);

