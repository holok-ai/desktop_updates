import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';
import { isGuardErrorPayload } from './guard-error-shape.js';

/**
 * Detects guard messages and error payloads and hides them from the chat view.
 *
 * Guard flow produces 3–4 messages sharing the same branchId:
 *
 *   Guard passed (4 messages):
 *     User Request, Guard Request, Guard Response, User Response
 *
 *   Guard failed (3 messages):
 *     User Request, Guard Request, Guard Response
 *
 * The Guard Response is identified by its content shape:
 *   `{ response: { passed: boolean, errors?: string[], reason?: string } }`
 *
 * The Guard Request is a user-role message in the same branchId group whose
 * content is longer than the user's actual request (it wraps the user's
 * message with guard evaluation instructions).
 *
 * This inspector hides both the Guard Request and Guard Response, leaving
 * only the user's original request and the LLM response (if the guard passed).
 * The kept user message is annotated with `guardExecution` and `guardMessageId`.
 *
 * Error payloads (`{ type: "error", status: 400, … }`) are also hidden.
 */
export class GuardInspector implements IMessageInspector {
  inspect(messages: Message[]): Message[] {
    // --- Pass 1: identify guard responses and error payloads ---------------

    /** Maps message index → whether the guard passed (true/false). */
    const guardResponsePassed = new Map<number, boolean>();
    const guardBranchIds = new Set<string>();

    for (const [i, message] of messages.entries()) {
      try {
        const content = this.parseContent(message.content);
        if (content === null) continue;

        const passed = this.getGuardPassed(content);
        if (passed !== null) {
          guardResponsePassed.set(i, passed);
          guardBranchIds.add(message.branchId);
        }

        if (this.isErrorPayload(content)) {
          message.isHidden = true;
        }
      } catch (error) {
        log.error('[GuardInspector] Error processing message:', error);
      }
    }

    // --- Pass 2: hide guard messages per branchId group --------------------

    for (const branchId of guardBranchIds) {
      const branchEntries: { msg: Message; idx: number }[] = [];
      for (const [i, msg] of messages.entries()) {
        if (msg.branchId === branchId) {
          branchEntries.push({ msg, idx: i });
        }
      }

      // Find the guard response entry for this branch (need its passed value, id, and error text)
      let guardPassed = false;
      let guardResponseId: string | null = null;
      let guardErrorText = '';
      for (const { msg, idx } of branchEntries) {
        if (guardResponsePassed.has(idx)) {
          msg.isHidden = true;
          guardPassed = guardResponsePassed.get(idx) ?? false;
          guardResponseId = msg.id;
          if (!guardPassed) {
            guardErrorText = this.extractGuardError(msg.content);
          }
        }
      }

      // If there are 2+ user messages, the extra ones are guard requests.
      // The guard request is always longer than the user's actual message
      // because it wraps it with evaluation instructions.
      const userEntries = branchEntries.filter(({ msg }) => msg.role === 'user');
      if (userEntries.length > 1) {
        // Sort ascending by content byte-length; shortest = real user request.
        // Tiebreaker: earlier createdAt wins (user request is created first).
        userEntries.sort((a, b) => {
          const lenDiff = a.msg.content.length - b.msg.content.length;
          if (lenDiff !== 0) return lenDiff;
          return a.msg.createdAt - b.msg.createdAt;
        });

        // Keep the first (shortest / earliest) — hide the rest
        for (let j = 1; j < userEntries.length; j++) {
          // eslint-disable-next-line security/detect-object-injection
          userEntries[j].msg.isHidden = true;
        }
      }

      // Check if any assistant response in this branch contains an embedded
      // PII Check Result that overrides the guard model's verdict.
      // This handles the case where the guard model incorrectly passes but
      // the main LLM detects PII and appends a failing check result.
      // Uses 'fail-context' so the UI keeps the response visible.
      let piiOverride = false;
      if (guardPassed) {
        for (const { msg } of branchEntries) {
          if (msg.role === 'assistant' && !msg.isHidden && typeof msg.content === 'string') {
            const piiResult = this.extractPiiCheckResult(msg.content);
            if (piiResult !== null && !piiResult.passed) {
              guardPassed = false;
              piiOverride = true;
              guardErrorText =
                piiResult.errors.length > 0
                  ? piiResult.errors.join('; ')
                  : 'PII detected in response';
              break;
            }
          }
        }
      }

      // Annotate the kept user message with guard outcome
      const keptUser = userEntries[0]?.msg;
      if (keptUser) {
        keptUser.guardExecution = guardPassed ? 'pass' : piiOverride ? 'fail-context' : 'fail';
        keptUser.guardMessageId = guardResponseId;
        keptUser.guardError = guardErrorText;
      }

      // Strip PII Check Result annotation from visible assistant responses
      for (const { msg } of branchEntries) {
        if (msg.role === 'assistant' && !msg.isHidden && typeof msg.content === 'string') {
          msg.content = this.stripGuardAnnotation(msg.content);
        }
      }
    }

    return messages;
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** Try to parse a content value as a JSON object. Returns null on failure. */
  private parseContent(content: unknown): unknown {
    if (typeof content === 'string') {
      try {
        return JSON.parse(content) as unknown;
      } catch {
        return null;
      }
    }
    if (content && typeof content === 'object') return content;
    return null;
  }

  /**
   * If content is a guard response, return whether the guard passed.
   * Returns `null` when content is not a guard response.
   * Supports:
   *   - Wrapped format: `{ response: { passed, errors?, reason? } }`
   *   - Double-encoded: `{ response: "{ \"passed\": ... }" }`
   *   - Top-level format: `{ passed, errors? }` (no `response` wrapper)
   */
  private getGuardPassed(content: unknown): boolean | null {
    if (!content || typeof content !== 'object') return null;

    // Try wrapped format first (e.g. Ollama wrapper with `response` key)
    if ('response' in content) {
      let response = (content as { response: unknown }).response;

      if (typeof response === 'string') {
        try {
          response = JSON.parse(response);
        } catch {
          return null;
        }
      }

      if (response && typeof response === 'object' && 'passed' in response) {
        return !!(response as { passed: unknown }).passed;
      }
    }

    // Try top-level format: { passed: boolean, errors?: string[] }
    // Require both `passed` and `errors` keys to avoid false positives.
    if ('passed' in content && 'errors' in content) {
      const obj = content as { passed: unknown };
      if (typeof obj.passed === 'boolean') {
        return obj.passed;
      }
    }

    return null;
  }

  /**
   * Extract human-readable error text from a guard response message's content.
   * Supports both wrapped (`{ response: { errors } }`) and top-level (`{ errors }`) formats.
   * Falls back to a generic message if parsing fails.
   */
  private extractGuardError(content: string): string {
    try {
      const parsed = this.parseContent(content);
      if (!parsed || typeof parsed !== 'object') {
        return 'Request blocked by guard';
      }

      let target: unknown = null;

      // Try wrapped format first
      if ('response' in parsed) {
        let response = (parsed as { response: unknown }).response;
        if (typeof response === 'string') {
          response = JSON.parse(response);
        }
        target = response;
      }

      // Fall back to top-level format
      if (!target && 'passed' in parsed) {
        target = parsed;
      }

      if (target && typeof target === 'object') {
        const r = target as { errors?: string[]; reason?: string };
        if (r.errors?.length) {
          return r.errors.join('; ');
        }
        if (r.reason) {
          return r.reason;
        }
      }
    } catch {
      // Content wasn't parseable
    }
    return 'Request blocked by guard';
  }

  /**
   * Extract an embedded PII Check Result from an assistant response's text content.
   * The server may append a block like:
   *   **PII Check Result:**
   *   ```json
   *   { "passed": false, "errors": ["Social Security Number"] }
   *   ```
   * Returns the parsed result or null if not found.
   */
  private extractPiiCheckResult(content: string): { passed: boolean; errors: string[] } | null {
    // Match the JSON code block following "PII Check Result"
    const match = /\*\*PII Check Result:?\*\*[\s\S]*?```json\s*([\s\S]*?)```/.exec(content);
    if (!match?.[1]) return null;

    try {
      const parsed = JSON.parse(match[1]) as unknown;
      if (parsed && typeof parsed === 'object' && 'passed' in parsed) {
        const obj = parsed as { passed: unknown; errors?: unknown[] };
        return {
          passed: !!obj.passed,
          errors: Array.isArray(obj.errors)
            ? obj.errors.filter((e): e is string => typeof e === 'string')
            : [],
        };
      }
    } catch {
      // JSON in the code block wasn't parseable
    }
    return null;
  }

  /**
   * Strip guard annotation text (e.g. PII Check Result) appended by the server
   * to assistant response content. Removes the `**PII Check Result:**` block
   * and its fenced JSON code block.
   */
  private stripGuardAnnotation(text: string): string {
    return text.replace(/\s*\*\*PII Check Result:?\*\*[\s\S]*?```[\s\S]*?```/g, '').trim();
  }

  private isErrorPayload(content: unknown): boolean {
    return isGuardErrorPayload(content);
  }
}
