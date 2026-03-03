import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';
import { isGuardErrorPayload } from './guard-error-shape.js';

/**
 * Formats raw JSON error responses into human-readable messages.
 *
 * When an LLM request fails, the server stores the raw error envelope as the
 * response text.  This inspector detects assistant messages whose `content` is
 * one of those JSON error payloads, extracts the meaningful error message, and
 * replaces the content so the chat view shows something user-friendly.
 *
 * Supported error envelope shapes (all share a top-level `type: "error"`):
 *
 *   Ollama:
 *     { type:"error", error:{ error:"<msg>" } }
 *
 *   OpenAI:
 *     { type:"error", error:{ message:"<msg>", type:"<kind>", code:"<code>" } }
 *
 *   Claude (flat):
 *     { type:"error", error:{ message:"<msg>" } }
 *
 *   Claude (nested – PII guard, model not found, etc.):
 *     { type:"error", error:{ type:"error", error:{ type:"error", error:{ type:"<kind>", message:"<msg>" } } } }
 *
 * The inspector recursively unwraps `error.error` until it finds a leaf with
 * a `message` string or a plain `error` string.
 */
export class ErrorResponseInspector implements IMessageInspector {
  inspect(messages: Message[]): Message[] {
    let formattedCount = 0;

    for (const message of messages) {
      if (message.role !== 'assistant') continue;

      const parsed = this.parseErrorPayload(message.content);
      if (!parsed) continue;

      const friendly = this.formatError(parsed);
      if (friendly) {
        message.content = friendly;
        formattedCount++;
      }
    }

    if (formattedCount > 0) {
      log.info(
        '[ErrorResponseInspector] Formatted',
        formattedCount,
        'error response(s) into readable text',
      );
    }

    return messages;
  }

  // ── Parsing ────────────────────────────────────────────────────────────

  /**
   * Try to parse message content as a JSON error envelope.
   * Returns the parsed object only if it has `type: "error"`.
   *
   * Guard error payloads (status 400 with requestId/seq/error) are left
   * untouched so the downstream GuardInspector can hide them as usual.
   */
  private parseErrorPayload(content: unknown): Record<string, unknown> | null {
    if (typeof content !== 'string') return null;

    const trimmed = content.trim();
    if (!trimmed.startsWith('{')) return null;

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.type !== 'error') return null;

      // Skip guard error payloads — GuardInspector handles those
      if (isGuardErrorPayload(parsed)) return null;

      return parsed;
    } catch {
      return null;
    }
  }

  // ── Formatting ─────────────────────────────────────────────────────────

  /**
   * Build a user-friendly error string from the parsed envelope.
   */
  private formatError(payload: Record<string, unknown>): string | null {
    const errorMessage = this.extractMessage(payload);
    if (!errorMessage) return null;

    const errorCode = this.extractCode(payload);
    const errorType = this.extractErrorType(payload);

    // Build the display string
    const parts: string[] = [];

    // Label line
    if (errorType) {
      parts.push(`Error (${errorType}): ${errorMessage}`);
    } else if (errorCode) {
      parts.push(`Error [${errorCode}]: ${errorMessage}`);
    } else {
      parts.push(`Error: ${errorMessage}`);
    }

    return parts.join('\n');
  }

  /**
   * Recursively unwrap nested `error` objects to find the deepest `message`
   * or plain `error` string.
   *
   * Claude wraps errors deeply:
   *   error → { type:"error", error: { type:"error", error: { message:"…" } } }
   *
   * Ollama uses:
   *   error → { error: "<msg>" }
   *
   * OpenAI / Claude (flat) use:
   *   error → { message: "<msg>" }
   */
  private extractMessage(payload: Record<string, unknown>): string | null {
    const error = payload.error;
    if (!error) return null;

    // Ollama / flat string: error is { error: "<message>" }
    // and OpenAI / Claude: error is { message: "<message>" }
    return this.unwrapErrorMessage(error);
  }

  /**
   * Walk into nested error objects looking for the most specific message.
   * Stops at a maximum depth to avoid infinite loops.
   */
  private unwrapErrorMessage(value: unknown, depth = 0): string | null {
    if (depth > 10) return null;

    if (typeof value === 'string') return value;

    if (!value || typeof value !== 'object') return null;

    const obj = value as Record<string, unknown>;

    // If this level has its own nested `error`, recurse into it first
    // to prefer the deepest/most specific message.
    if (obj.error !== undefined && obj.error !== null) {
      const deeper = this.unwrapErrorMessage(obj.error, depth + 1);
      if (deeper) return deeper;
    }

    // If we have a `message` at this level, use it
    if (typeof obj.message === 'string' && obj.message.length > 0) {
      return obj.message;
    }

    return null;
  }

  /**
   * Extract an error code if one exists (OpenAI-style `code` field).
   */
  private extractCode(payload: Record<string, unknown>): string | null {
    const error = payload.error;
    if (!error || typeof error !== 'object') return null;

    const code = (error as Record<string, unknown>).code;
    if (typeof code === 'string' && code.length > 0) return code;

    return null;
  }

  /**
   * Extract a categorising error type from the deepest nested error.
   * Claude uses `type` fields like "not_found_error", "invalid_request_error", etc.
   * OpenAI uses `type` like "invalid_request_error", "tokens", etc.
   */
  private extractErrorType(payload: Record<string, unknown>): string | null {
    return this.unwrapErrorType(payload.error);
  }

  /**
   * Walk nested error objects to find the deepest `type` that is NOT just "error".
   */
  private unwrapErrorType(value: unknown, depth = 0): string | null {
    if (depth > 10) return null;
    if (!value || typeof value !== 'object') return null;

    const obj = value as Record<string, unknown>;

    // Recurse into nested error first to prefer deepest type
    if (obj.error !== undefined && obj.error !== null) {
      const deeper = this.unwrapErrorType(obj.error, depth + 1);
      if (deeper) return deeper;
    }

    // Use this level's type if it's meaningful (not just "error")
    const type = obj.type;
    if (typeof type === 'string' && type.length > 0 && type !== 'error') {
      return type;
    }

    return null;
  }
}
