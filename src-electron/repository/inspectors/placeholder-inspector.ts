import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';

/**
 * Inserts placeholder user messages for orphan assistant messages, and
 * recovers missing prompt text for user messages whose content is empty.
 *
 * **Orphan assistant handling**: If an assistant message doesn't have a
 * preceding user message on the same branchId, a synthetic user message
 * is created so the chat view always has proper request-response pairing.
 *
 * **Null prompt recovery**: Some providers (e.g. OpenAI Responses API)
 * store the conversation history in `rawData.input[]` rather than
 * populating the `user_prompt` column on the server side.  When a user
 * message has empty content but its rawData contains an `input[]` array,
 * the last `role: "user"` entry in that array is used as the content.
 */
export class PlaceholderInspector implements IMessageInspector {
  inspect(messages: Message[]): Message[] {
    // Pass 0: recover missing prompt text from rawData.input[]
    this.recoverNullPrompts(messages);
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

  // ── Null prompt recovery ─────────────────────────────────────────────

  /**
   * For user messages with empty content, attempt to recover the prompt
   * text from `rawData.input[]` (OpenAI Responses API format).
   *
   * The Responses API sends the full conversation history in an `input[]`
   * array instead of a `messages[]` array.  The server may not extract the
   * last user turn into the `user_prompt` column, leaving `dto.content`
   * null.  We walk the `input[]` array in reverse and use the text of the
   * last `role: "user"` entry.
   */
  private recoverNullPrompts(messages: Message[]): void {
    let recoveredCount = 0;

    for (const msg of messages) {
      if (msg.role !== 'user') continue;
      if (msg.content && msg.content.trim().length > 0) continue;

      const recovered = this.extractLastUserInputText(msg.rawData);
      if (recovered) {
        msg.content = recovered;
        recoveredCount++;
      }
    }

    if (recoveredCount > 0) {
      log.info(
        '[PlaceholderInspector] Recovered',
        recoveredCount,
        'null prompt(s) from rawData.input[]',
      );
    }
  }

  /**
   * Walk rawData.input[] in reverse to find the last entry with
   * `role: "user"` and return its text content.
   */
  private extractLastUserInputText(rawData: unknown): string | null {
    if (!rawData || typeof rawData !== 'object') return null;

    const data = rawData as Record<string, unknown>;
    const input = data.input;
    if (!Array.isArray(input) || input.length === 0) return null;
    const inputItems = input as unknown[];

    for (let i = inputItems.length - 1; i >= 0; i--) {
      // eslint-disable-next-line security/detect-object-injection
      const entry = inputItems[i];
      if (!entry || typeof entry !== 'object') continue;

      const rec = entry as Record<string, unknown>;
      if (rec.role !== 'user') continue;

      const content = rec.content;
      if (typeof content === 'string' && content.trim().length > 0) {
        return content.trim();
      }

      // Content may be an array of content blocks
      if (Array.isArray(content)) {
        for (const block of content) {
          if (!block || typeof block !== 'object') continue;
          const b = block as Record<string, unknown>;
          if (b.type === 'text' && typeof b.text === 'string' && b.text.trim().length > 0) {
            return b.text.trim();
          }
        }
      }
    }

    return null;
  }
}
