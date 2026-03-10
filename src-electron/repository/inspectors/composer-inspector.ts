import log from 'electron-log';
import type { Message } from '../../types/thread.types.js';
import type { IMessageInspector } from './message-inspector.js';
import {
  parseComposerTag,
  stripPromptAugmentation,
} from '../../../src-shared/utils/composer-parser.js';

/**
 * Processes composer-related content in messages:
 * 1. Extracts <composer> tag content from assistant messages into message.composer
 * 2. Strips prompt augmentation banners from user messages so the chat
 *    bubble shows only the original user text.
 */
export class ComposerInspector implements IMessageInspector {
  inspect(messages: Message[]): Message[] {
    let extractedCount = 0;
    let strippedCount = 0;

    for (const msg of messages) {
      if (msg.role === 'assistant') {
        if (msg.composer) continue; // Already parsed

        const result = parseComposerTag(msg.content);
        if (result.composer) {
          msg.composer = result.composer;
          msg.content = result.strippedContent;
          extractedCount++;
        }
      } else if (msg.role === 'user') {
        const stripped = stripPromptAugmentation(msg.content);
        if (stripped !== msg.content) {
          msg.content = stripped;
          strippedCount++;
        }
      }
    }

    if (extractedCount > 0) {
      log.info(`[ComposerInspector] Extracted composer content from ${extractedCount} message(s)`);
    }
    if (strippedCount > 0) {
      log.info(`[ComposerInspector] Stripped augmentation from ${strippedCount} user message(s)`);
    }

    return messages;
  }
}
