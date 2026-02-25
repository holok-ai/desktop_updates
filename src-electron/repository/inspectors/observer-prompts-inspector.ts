import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';

/** Branch IDs used by background observer tasks — messages on these branches are ephemeral. */
const OBSERVER_BRANCH_IDS = new Set(['0.0.0', '0.0.0.0']);

/**
 * Filters out messages produced by background observer tasks.
 *
 * Observer prompts are sent with branch_id '0.0.0' or '0.0.0.0'.
 * These messages are ephemeral and should never appear in the thread view.
 */
export class ObserverPromptsInspector implements IMessageInspector {
  inspect(messages: Message[]): Message[] {
    const filtered = messages.filter((m) => !OBSERVER_BRANCH_IDS.has(m.branchId));

    const removed = messages.length - filtered.length;
    if (removed > 0) {
      log.info(`[ObserverPromptsInspector] Removed ${removed} observer message(s).`);
    }

    return filtered;
  }
}
