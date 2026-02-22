import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';

/**
 * Filters out duplicate audit records from tool-loop continuations.
 *
 * When a chat request uses tools, the audit service may record both the
 * initial request and continuation request(s) with identical content and
 * branch. This inspector keeps only the earliest occurrence per
 * (role, content, branchId) key.
 */
export class DuplicationInspector implements IMessageInspector {
  inspect(messages: Message[]): Message[] {
    const seen = new Map<string, Message>();
    const filtered: Message[] = [];

    for (const message of messages) {
      const key = `${message.role}:${message.content}:${message.branchId}`;

      if (seen.has(key)) {
        const existing = seen.get(key)!;

        if (message.createdAt < existing.createdAt) {
          const index = filtered.indexOf(existing);
          if (index !== -1) {
            filtered[index] = message;
          }
          seen.set(key, message);
        }

        log.info('[DuplicationInspector] Skipping duplicate message:', {
          role: message.role,
          branchId: message.branchId,
          contentPreview: message.content ? message.content.substring(0, 50) : '(empty)',
        });
      } else {
        seen.set(key, message);
        filtered.push(message);
      }
    }

    return filtered;
  }
}
