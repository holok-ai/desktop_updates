/* eslint-disable @typescript-eslint/strict-boolean-expressions, security/detect-object-injection */
import type { Message } from '$lib/types/thread.type';
import type { CompressionContext, CompressionPolicy } from './types';

export class DropRedundantMessages implements CompressionPolicy {
  readonly name = 'DropRedundantMessages';
  readonly priority = 150;

  private lowValuePatterns = [
    /^(ok|okay|k|got it|thanks|thank you|thx|ty|sure|yes|no|yep|nope|cool|great|nice|perfect|awesome|sounds good|makes sense|i see|understood|right|alright)\.?$/i,
  ];

  constructor(private maxShortTokens: number = 30) {}

  shouldRun(messages: Message[], context: CompressionContext): boolean {
    if (context.currentTokenCount <= context.targetTokenCount) {
      return false;
    }
    return messages.some((message) => !message.context?.isProtected && this.isLowValue(message));
  }

  apply(messages: Message[], _context: CompressionContext): Promise<Message[]> {
    const dropIndices = new Set<number>();

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message === undefined || message.context?.isProtected || !this.isLowValue(message)) {
        continue;
      }

      dropIndices.add(i);

      if (message.role === 'user' && i + 1 < messages.length) {
        const nextMessage = messages[i + 1];
        if (nextMessage?.role === 'assistant' && !nextMessage.context?.isProtected) {
          dropIndices.add(i + 1);
        }
      }

      if (message.role === 'assistant' && i - 1 >= 0) {
        const previousMessage = messages[i - 1];
        if (previousMessage?.role === 'user' && !previousMessage.context?.isProtected) {
          dropIndices.add(i - 1);
        }
      }
    }

    return Promise.resolve(messages.filter((_message, index) => !dropIndices.has(index)));
  }

  private isLowValue(message: Message): boolean {
    if ((message.tokens ?? 0) > this.maxShortTokens) {
      return false;
    }
    const trimmed = message.content.trim();
    return this.lowValuePatterns.some((pattern) => pattern.test(trimmed));
  }
}
