import type { Message } from '$lib/types/thread.type';
import type { CompressionContext, CompressionPolicy } from './types';

export class SummarizeOldTurns implements CompressionPolicy {
  readonly name = 'SummarizeOldTurns';
  readonly priority = 300;

  constructor(private minMessagesToSummarize: number = 4) {}

  shouldRun(messages: Message[], context: CompressionContext): boolean {
    if (context.currentTokenCount <= context.targetTokenCount) {
      return false;
    }

    const unprotectedCount = messages.filter(
      (message) => message.context?.isProtected !== true && message.role !== 'system',
    ).length;

    return unprotectedCount >= this.minMessagesToSummarize;
  }

  async apply(messages: Message[], context: CompressionContext): Promise<Message[]> {
    const systemMessages = messages.filter((message) => message.role === 'system');
    const nonSystemMessages = messages.filter((message) => message.role !== 'system');

    const toSummarize: Message[] = [];
    const toKeep: Message[] = [];
    let hasHitProtected = false;

    for (const message of nonSystemMessages) {
      if (!hasHitProtected && message.context?.isProtected !== true) {
        toSummarize.push(message);
      } else {
        hasHitProtected = true;
        toKeep.push(message);
      }
    }

    if (toSummarize.length < this.minMessagesToSummarize) {
      return messages;
    }

    const sourceMessageIds = toSummarize.map((message) => message.id);
    const summary = await context.summarize(this.buildPrompt(toSummarize), {
      policy: this.name,
      sourceMessageIds,
      modelId: toSummarize[toSummarize.length - 1]?.modelId ?? undefined,
    });

    const anchorMessage = toSummarize[0] ?? messages[0];
    if (anchorMessage === undefined) {
      return messages;
    }

    const summaryTokenCount = context.estimateTokens(summary);
    const summaryMessage: Message = {
      ...anchorMessage,
      id: `compressed-summary-${Date.now()}`,
      role: 'assistant',
      content: `[CONVERSATION SUMMARY]\n${summary}`,
      tokens: summaryTokenCount,
      context: {
        turnIndex: anchorMessage.context?.turnIndex ?? 0,
        isProtected: false,
        hasCodeBlock: /```[\s\S]*?```/.test(summary),
        compressedByPolicy: this.name,
        originalTokenSize: toSummarize.reduce((sum, message) => sum + (message.tokens ?? 0), 0),
        compressedTokenSize: summaryTokenCount,
        compressionTimestamp: Date.now(),
        sourceMessageIds,
      },
    };

    context.recordTrace({
      sourceMessageIds,
      content: summaryMessage.content,
      policy: this.name,
    });

    return [...systemMessages, summaryMessage, ...toKeep];
  }

  private buildPrompt(messages: Message[]): string {
    const conversationText = messages
      .map((message) => `[${message.role.toUpperCase()}]: ${message.content}`)
      .join('\n\n');

    return `Summarize the following conversation turns concisely.

Preserve:
- Key decisions, facts, and requirements
- Constraints and preferences
- Current state and unresolved items
- Relevant code snippets, paths, commands, and identifiers

CONVERSATION TURNS:
${conversationText}

Return plain summary text only.`;
  }
}
