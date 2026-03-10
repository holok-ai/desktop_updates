import type { Message } from '$lib/types/thread.type';
import type { CompressionContext, CompressionPolicy } from './types';

export class CompressLongResponses implements CompressionPolicy {
  readonly name = 'CompressLongResponses';
  readonly priority = 200;

  constructor(
    private maxMessageTokens: number = 500,
    private targetCompressionRatio: number = 0.2,
  ) {}

  shouldRun(messages: Message[], _context: CompressionContext): boolean {
    return messages.some(
      (message) =>
        message.role === 'assistant' &&
        message.context?.isProtected !== true &&
        message.context?.compressedByPolicy === undefined &&
        (message.tokens ?? 0) > this.maxMessageTokens,
    );
  }

  async apply(messages: Message[], context: CompressionContext): Promise<Message[]> {
    const sortedCandidates = messages
      .map((message, index) => ({ message, index }))
      .filter(
        ({ message }) =>
          message.role === 'assistant' &&
          message.context?.isProtected !== true &&
          message.context?.compressedByPolicy === undefined &&
          (message.tokens ?? 0) > this.maxMessageTokens,
      )
      .sort((left, right) => (right.message.tokens ?? 0) - (left.message.tokens ?? 0));

    const byIndex = new Map<number, Message>(messages.map((message, index) => [index, message]));

    for (const candidate of sortedCandidates) {
      const message = byIndex.get(candidate.index);
      if (message === undefined) {
        continue;
      }

      const originalTokenCount = message.tokens ?? context.estimateTokens(message.content);
      const pairedUser =
        candidate.index > 0 && byIndex.get(candidate.index - 1)?.role === 'user'
          ? byIndex.get(candidate.index - 1)
          : undefined;
      const sourceMessageIds =
        pairedUser !== undefined ? [pairedUser.id, message.id] : [message.id];

      const summary = await context.summarize(this.buildPrompt(message, pairedUser), {
        policy: this.name,
        sourceMessageIds,
        modelId: message.modelId ?? undefined,
      });

      const newTokenCount = context.estimateTokens(summary);
      if (newTokenCount >= originalTokenCount) {
        continue;
      }

      const updated: Message = {
        ...message,
        content: summary,
        tokens: newTokenCount,
        context: {
          turnIndex: message.context?.turnIndex ?? 0,
          isProtected: message.context?.isProtected ?? false,
          hasCodeBlock: message.context?.hasCodeBlock ?? /```[\s\S]*?```/.test(summary),
          compressedByPolicy: this.name,
          originalTokenSize: message.context?.originalTokenSize ?? originalTokenCount,
          compressedTokenSize: newTokenCount,
          compressionTimestamp: Date.now(),
          sourceMessageIds,
        },
      };
      byIndex.set(candidate.index, updated);

      context.recordTrace({
        sourceMessageIds,
        content: summary,
        policy: this.name,
      });

      const projectedTokens = [...byIndex.values()].reduce(
        (sum, item) => sum + (item.tokens ?? 0),
        0,
      );
      if (projectedTokens <= context.targetTokenCount) {
        break;
      }
    }

    return [...byIndex.entries()]
      .sort((left, right) => left[0] - right[0])
      .map((entry) => entry[1]);
  }

  private buildPrompt(assistantMessage: Message, userMessage?: Message): string {
    const targetLength = Math.max(
      100,
      Math.round((assistantMessage.tokens ?? 500) * this.targetCompressionRatio),
    );
    const userSection =
      userMessage !== undefined ? `USER REQUEST:\n${userMessage.content}\n\n` : '';

    return `Summarize the following conversation turn to approximately ${targetLength} tokens.

Preserve:
- Decisions, conclusions, and final answers
- Code snippets, function/variable names, file paths, and commands that remain relevant
- Specific values, configurations, URLs, and identifiers
- Caveats, warnings, and constraints
- Any explicit user requirements

Omit:
- Verbose reasoning and filler
- Repeated details
- Boilerplate explanations

${userSection}ASSISTANT RESPONSE TO SUMMARIZE:
${assistantMessage.content}`;
  }
}
