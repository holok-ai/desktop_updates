import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';

type ChatCompletionChunk = {
  object?: string;
  choices?: unknown[];
};

/**
 * Filters tool-use streaming chunk messages from the thread view.
 *
 * - Removes empty chunks (choices: []).
 * - Hides non-empty chunks (choices length > 0) so they do not render.
 */
export class ToolUseInspector implements IMessageInspector {
  inspect(messages: Message[]): Message[] {
    let removedCount = 0;
    let hiddenCount = 0;

    const filtered = messages.filter((message) => {
      const chunk = this.parseChunk(message.content);
      if (!chunk) {
        return true;
      }

      const choices = chunk.choices;
      if (!Array.isArray(choices)) {
        return true;
      }

      if (choices.length === 0) {
        removedCount += 1;
        return false;
      }

      message.isHidden = true;
      hiddenCount += 1;
      return true;
    });

    if (removedCount > 0 || hiddenCount > 0) {
      log.info('[ToolUseInspector] Filtered tool-use chunks:', {
        removedCount,
        hiddenCount,
      });
    }

    return filtered;
  }

  private parseChunk(content: string): ChatCompletionChunk | null {
    if (typeof content !== 'string') return null;

    const trimmed = content.trim();
    if (!trimmed.startsWith('{')) return null;

    try {
      const parsed = JSON.parse(trimmed) as ChatCompletionChunk;
      if (parsed?.object !== 'chat.completion.chunk') return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
