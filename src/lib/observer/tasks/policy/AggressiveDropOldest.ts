/* eslint-disable @typescript-eslint/strict-boolean-expressions, security/detect-object-injection */
import type { Message } from '$lib/types/thread.type';
import type { CompressionContext, CompressionPolicy } from './types';

export class AggressiveDropOldest implements CompressionPolicy {
  readonly name = 'AggressiveDropOldest';
  readonly priority = 400;

  shouldRun(_messages: Message[], context: CompressionContext): boolean {
    return context.currentTokenCount > context.targetTokenCount;
  }

  apply(messages: Message[], context: CompressionContext): Promise<Message[]> {
    const result = [...messages];
    let currentTokens = context.currentTokenCount;

    while (currentTokens > context.targetTokenCount && result.length > 2) {
      const dropIndex = result.findIndex(
        (message) => message.role !== 'system' && !message.context?.isProtected,
      );

      if (dropIndex === -1) {
        break;
      }

      const dropped = result[dropIndex];
      if (dropped === undefined) {
        break;
      }
      currentTokens -= dropped.tokens ?? 0;

      if (
        dropped.role === 'user' &&
        dropIndex + 1 < result.length &&
        result[dropIndex + 1]?.role === 'assistant'
      ) {
        currentTokens -= result[dropIndex + 1]?.tokens ?? 0;
        result.splice(dropIndex, 2);
      } else {
        result.splice(dropIndex, 1);
      }
    }

    return Promise.resolve(result);
  }
}
