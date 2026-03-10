import type { Message } from '$lib/types/thread.type';
import type { CompressionContext, CompressionPolicy, CompressionTrace, SummarizeFn } from './types';

export interface PipelineConfig {
  maxContextTokens: number;
  reserveTokens: number;
  targetTokenCount: number;
  systemPrompt: string;
  estimateTokens: (text: string) => number;
  summarize: SummarizeFn;
}

export interface CompressionResult {
  messages: Message[];
  traces: CompressionTrace[];
  beforeTokens: number;
  afterTokens: number;
  policyStats: Array<{
    policy: string;
    beforeTokens: number;
    afterTokens: number;
    tokenDelta: number;
    compressedMessageCount: number;
  }>;
}

export class CompressionPipeline {
  private policies: CompressionPolicy[] = [];

  constructor(private config: PipelineConfig) {}

  use(policy: CompressionPolicy): this {
    this.policies.push(policy);
    return this;
  }

  async compress(messages: Message[]): Promise<CompressionResult> {
    const sorted = [...this.policies].sort((a, b) => a.priority - b.priority);
    const traces: CompressionTrace[] = [];
    const policyStats: CompressionResult['policyStats'] = [];

    let enriched = this.enrichMessages(messages);
    let context = this.buildContext(enriched, traces);
    const beforeTokens = context.currentTokenCount;

    for (const policy of sorted) {
      if (!policy.shouldRun(enriched, context)) {
        continue;
      }

      const beforeMessages = enriched;
      const beforeTokensForPolicy = context.currentTokenCount;
      const traceCountBefore = traces.length;
      enriched = await policy.apply(enriched, context);
      context = this.buildContext(enriched, traces);
      const newTraces = traces
        .slice(traceCountBefore)
        .filter((trace) => trace.policy === policy.name);
      const compressedByTrace = new Set(newTraces.flatMap((trace) => trace.sourceMessageIds)).size;

      let compressedByDiff = 0;
      if (compressedByTrace === 0) {
        const beforeMap = new Map(beforeMessages.map((message) => [message.id, message]));
        for (const message of enriched) {
          if (message.context?.compressedByPolicy !== policy.name) {
            continue;
          }
          const before = beforeMap.get(message.id);
          if (before?.content !== message.content) {
            compressedByDiff++;
          }
        }
      }

      policyStats.push({
        policy: policy.name,
        beforeTokens: beforeTokensForPolicy,
        afterTokens: context.currentTokenCount,
        tokenDelta: beforeTokensForPolicy - context.currentTokenCount,
        compressedMessageCount: compressedByTrace > 0 ? compressedByTrace : compressedByDiff,
      });

      if (context.currentTokenCount <= context.targetTokenCount) {
        break;
      }
    }

    return {
      messages: enriched,
      traces,
      beforeTokens,
      afterTokens: context.currentTokenCount,
      policyStats,
    };
  }

  private enrichMessages(messages: Message[]): Message[] {
    let turnIndex = 0;

    return messages.map((message, index) => {
      const tokenCount = message.tokens ?? this.config.estimateTokens(message.content);
      if (message.role === 'user') {
        turnIndex = Math.floor(index / 2);
      }

      return {
        ...message,
        tokens: tokenCount,
        context: {
          turnIndex,
          isProtected: message.context?.isProtected ?? message.role === 'system',
          hasCodeBlock: message.context?.hasCodeBlock ?? /```[\s\S]*?```/.test(message.content),
          compressedByPolicy: message.context?.compressedByPolicy,
          originalTokenSize: message.context?.originalTokenSize,
          compressedTokenSize: message.context?.compressedTokenSize,
          compressionTimestamp: message.context?.compressionTimestamp,
          sourceMessageIds: message.context?.sourceMessageIds,
        },
      };
    });
  }

  private buildContext(messages: Message[], traces: CompressionTrace[]): CompressionContext {
    const systemPromptTokens = this.config.estimateTokens(this.config.systemPrompt);
    const currentTokenCount = messages.reduce(
      (sum, message) => sum + (message.tokens ?? this.config.estimateTokens(message.content)),
      0,
    );

    return {
      maxContextTokens: this.config.maxContextTokens,
      currentTokenCount,
      systemPromptTokens,
      historyBudget: this.config.maxContextTokens - systemPromptTokens - this.config.reserveTokens,
      reserveTokens: this.config.reserveTokens,
      targetTokenCount: this.config.targetTokenCount,
      summarize: this.config.summarize,
      estimateTokens: this.config.estimateTokens,
      recordTrace: (trace: CompressionTrace) => traces.push(trace),
    };
  }
}
