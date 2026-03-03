import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';

/**
 * Inserts placeholder user messages for orphan assistant messages.
 *
 * If an assistant message doesn't have a preceding user message on the
 * same branchId, a synthetic user message is created so the chat view
 * always has proper request-response pairing.
 */
export class PlaceholderInspector implements IMessageInspector {
  inspect(messages: Message[]): Message[] {
    const sorted = [...messages].sort((a, b) => {
      const [aRow, aLane, aIter] = a.branchId.split('.').map(Number);
      const [bRow, bLane, bIter] = b.branchId.split('.').map(Number);

      if (aRow !== bRow) return aRow - bRow;
      if (aLane !== bLane) return aLane - bLane;
      if (aIter !== bIter) return aIter - bIter;
      return a.createdAt - b.createdAt;
    });

    const placeholderByBranch = new Map<string, Message>();
    const toInsert: { index: number; message: Message }[] = [];

    for (let i = 0; i < sorted.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const message = sorted[i];

      if (message.role === 'assistant') {
        const shouldMatchHidden = message.isHidden === true;
        let hasUserMessage = false;
        for (let j = i - 1; j >= 0; j--) {
          // eslint-disable-next-line security/detect-object-injection
          const candidate = sorted[j];
          if (candidate.branchId !== message.branchId) continue;
          if (candidate.role !== 'user') continue;
          const isHidden = candidate.isHidden === true;
          if (isHidden === shouldMatchHidden) {
            hasUserMessage = true;
            break;
          }
        }

        if (!hasUserMessage) {
          const existingPlaceholder = placeholderByBranch.get(message.branchId);
          if (existingPlaceholder) {
            if (message.isHidden) {
              existingPlaceholder.isHidden = true;
            }
            continue;
          }
          log.info(
            '[PlaceholderInspector] Creating placeholder user message for orphan assistant:',
            {
              assistantId: message.id,
              branchId: message.branchId,
            },
          );

          const placeholder: Message = {
            id: crypto.randomUUID(),
            threadId: message.threadId,
            title: message.title,
            userId: message.userId,
            role: 'user',
            content: '',
            createdAt: message.createdAt - 1,
            branchId: message.branchId,
            rawBranchId: message.rawBranchId,
            normalizedBranchId: message.normalizedBranchId,
            modelId: message.modelId,
            provider: message.provider,
            deletedAt: null,
            guardExecution: 'none',
            guardMessageId: null,
            guardError: '',
          };

          if (message.isHidden) {
            placeholder.isHidden = true;
          }
          placeholderByBranch.set(message.branchId, placeholder);
          toInsert.push({ index: i, message: placeholder });
        }
      }
    }

    // Insert in reverse order to keep indices stable
    for (let i = toInsert.length - 1; i >= 0; i--) {
      // eslint-disable-next-line security/detect-object-injection
      const { index, message } = toInsert[i];
      sorted.splice(index, 0, message);
    }

    if (toInsert.length > 0) {
      log.info('[PlaceholderInspector] Inserted', toInsert.length, 'placeholder user messages');
    }

    return sorted;
  }
}
