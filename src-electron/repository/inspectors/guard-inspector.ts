import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';

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
          userEntries[j].msg.isHidden = true;
        }
      }

      // Annotate the kept user message with guard outcome
      const keptUser = userEntries[0]?.msg;
      if (keptUser) {
        keptUser.guardExecution = guardPassed ? 'pass' : 'fail';
        keptUser.guardMessageId = guardResponseId;
        keptUser.guardError = guardErrorText;
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
   * Supports both object and double-encoded (JSON-string) `response` values,
   * and both `errors` (array) and `reason` (string) variants.
   */
  private getGuardPassed(content: unknown): boolean | null {
    if (!content || typeof content !== 'object' || !('response' in content)) return null;

    let response = (content as { response: unknown }).response;

    if (typeof response === 'string') {
      try {
        response = JSON.parse(response);
      } catch {
        return null;
      }
    }

    if (!response || typeof response !== 'object' || !('passed' in response)) return null;

    return !!(response as { passed: unknown }).passed;
  }

  /**
   * Extract human-readable error text from a guard response message's content.
   * Falls back to a generic message if parsing fails.
   */
  private extractGuardError(content: string): string {
    try {
      const parsed = this.parseContent(content);
      if (!parsed || typeof parsed !== 'object' || !('response' in parsed)) {
        return 'Request blocked by guard';
      }

      let response = (parsed as { response: unknown }).response;
      if (typeof response === 'string') {
        response = JSON.parse(response);
      }

      if (response && typeof response === 'object') {
        const r = response as { errors?: string[]; reason?: string };
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

  private isErrorPayload(content: unknown): boolean {
    if (!content || typeof content !== 'object') return false;
    const c = content as Record<string, unknown>;
    return c.type === 'error' && c.status === 400 && 'requestId' in c && 'seq' in c && 'error' in c;
  }
}
