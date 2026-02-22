import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';

/**
 * Detects guard responses and error payloads and marks them (and their
 * preceding request) as hidden so the chat view skips them.
 *
 * Guard responses have the shape `{ response: { passed: boolean, ... } }`.
 * Error payloads have `{ type: "error", status: 400, requestId, seq, error }`.
 */
export class GuardInspector implements IMessageInspector {
  inspect(messages: Message[]): Message[] {
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      if (message.role !== 'assistant' && message.role !== 'system') continue;

      try {
        let content: unknown = message.content;
        if (typeof content === 'string') {
          try {
            content = JSON.parse(content) as unknown;
          } catch {
            continue;
          }
        }

        if (this.isGuardResponse(content)) {
          message.isHidden = true;
          if (i > 0 && messages[i - 1].role === 'user') {
            messages[i - 1].isHidden = true;
          }
        }

        if (this.isErrorPayload(content)) {
          message.isHidden = true;
        }
      } catch (error) {
        log.error('[GuardInspector] Error processing guard message:', error);
      }
    }

    return messages;
  }

  private isGuardResponse(content: unknown): boolean {
    if (!content || typeof content !== 'object' || !('response' in content)) return false;

    let response = (content as { response: unknown }).response;

    if (typeof response === 'string') {
      try {
        response = JSON.parse(response);
      } catch {
        return false;
      }
    }

    return !!response && typeof response === 'object' && 'passed' in response;
  }

  private isErrorPayload(content: unknown): boolean {
    if (!content || typeof content !== 'object') return false;
    const c = content as Record<string, unknown>;
    return (
      c.type === 'error' &&
      c.status === 400 &&
      'requestId' in c &&
      'seq' in c &&
      'error' in c
    );
  }
}
