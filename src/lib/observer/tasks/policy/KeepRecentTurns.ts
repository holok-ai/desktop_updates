import type { Message } from '$lib/types/thread.type';
import type { CompressionContext, CompressionPolicy } from './types';

export class KeepRecentTurns implements CompressionPolicy {
  readonly name = 'KeepRecentTurns';
  readonly priority = 0;

  constructor(
    private recentTurnCount: number = 8,
    private reducedTurnCount: number = 4,
  ) {}

  shouldRun(_messages: Message[], _context: CompressionContext): boolean {
    return true;
  }

  apply(messages: Message[], context: CompressionContext): Promise<Message[]> {
    const totalTurns = Math.ceil(messages.filter((message) => message.role === 'user').length);

    // If there aren't more turns than the default protected count and we're over the
    // token limit, reduce the protected window so other policies have room to work.
    const effectiveKeep =
      totalTurns <= this.recentTurnCount && context.currentTokenCount > context.maxContextTokens
        ? this.reducedTurnCount
        : this.recentTurnCount;

    const protectFromTurn = totalTurns - effectiveKeep;

    const updated = messages.map((message) => {
      const turnIndex = message.context?.turnIndex ?? 0;
      const isRecent = turnIndex >= protectFromTurn;
      const isSystem = message.role === 'system';

      return {
        ...message,
        context: {
          turnIndex,
          isProtected: Boolean(message.context?.isProtected) || isRecent || isSystem,
          hasCodeBlock: message.context?.hasCodeBlock ?? /```[\s\S]*?```/.test(message.content),
          compressedByPolicy: message.context?.compressedByPolicy,
          originalTokenSize: message.context?.originalTokenSize,
          compressedTokenSize: message.context?.compressedTokenSize,
          compressionTimestamp: message.context?.compressionTimestamp,
          sourceMessageIds: message.context?.sourceMessageIds,
        },
      };
    });

    return Promise.resolve(updated);
  }
}
