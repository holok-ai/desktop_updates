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
    const ordered = this.orderMessages(messages);
    const turnIndexById = this.buildTurnIndexMap(ordered);

    return ordered.map((message) => {
      const tokenCount = message.tokens ?? this.config.estimateTokens(message.content);
      const turnIndex = turnIndexById.get(message.id) ?? 0;

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

  private orderMessages(messages: Message[]): Message[] {
    return [...messages].sort((left, right) => {
      const leftParts = this.parseBranchId(left.branchId);
      const rightParts = this.parseBranchId(right.branchId);

      if (leftParts.row !== rightParts.row) {
        return leftParts.row - rightParts.row;
      }
      if (leftParts.lane !== rightParts.lane) {
        return leftParts.lane - rightParts.lane;
      }
      if (leftParts.iteration !== rightParts.iteration) {
        return leftParts.iteration - rightParts.iteration;
      }
      if (left.createdAt !== right.createdAt) {
        return left.createdAt - right.createdAt;
      }
      return left.id.localeCompare(right.id);
    });
  }

  private parseBranchId(branchId: string): { row: number; lane: number; iteration: number } {
    const [rowRaw, laneRaw, iterationRaw] = branchId.split('.');
    const row = Number.parseInt(rowRaw ?? '0', 10);
    const lane = Number.parseInt(laneRaw ?? '0', 10);
    const iteration = Number.parseInt(iterationRaw ?? '0', 10);

    return {
      row: Number.isNaN(row) ? 0 : row,
      lane: Number.isNaN(lane) ? 0 : lane,
      iteration: Number.isNaN(iteration) ? 0 : iteration,
    };
  }

  private buildTurnIndexMap(messages: Message[]): Map<string, number> {
    const turnIndexById = new Map<string, number>();
    let currentTurn = -1;

    for (const message of messages) {
      if (message.role === 'user') {
        currentTurn += 1;
      }
      turnIndexById.set(message.id, Math.max(currentTurn, 0));
    }

    return turnIndexById;
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
