/**
 * Compress Context Task
 *
 * Builds and maintains observer-owned compressed context for chat submission.
 * Trigger conditions:
 * 1) No observer context exists yet
 * 2) Current context crosses compact threshold
 * 3) Large uncompressed assistant message is present
 */

import { get } from 'svelte/store';
import {
  ObserverTaskType,
  type BackgroundChatRequest,
} from '../../../../src-shared/types/observer.types';
import type { ObserverTask, ObserverThread } from '../observer-task.interface';
import type { Message } from '$lib/types/thread.type';
import { observerStore } from '../observer.store';
import { settingsStore } from '$lib/stores/settings.store';
import { getModelMaxTokens } from '$lib/services/model-token-limits';
import {
  AggressiveDropOldest,
  CompressLongResponses,
  CompressionPipeline,
  DropRedundantMessages,
  KeepRecentTurns,
  ProtectReferencedCode,
  SummarizeOldTurns,
  type SummarizeOptions,
} from './policy';

const TARGET_REDUCTION_RATIO = 0.2;
const LARGE_MESSAGE_MIN_TOKENS = 1800;
const MIN_TARGET_TOKEN_BUDGET = 1;
const RESPONSE_HEADROOM_TOKENS = 2048;

function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function messageTokens(message: Message): number {
  return message.tokens ?? estimateTokensFromText(message.content ?? '');
}

function totalTokens(messages: Message[]): number {
  return messages.reduce((sum, message) => sum + messageTokens(message), 0);
}

function logInfo(message: string, data?: unknown): void {
  window.electronAPI?.log?.info(message, data);
}

function thresholdRatio(): number {
  return get(settingsStore).contextCompactThreshold ?? 0.75;
}

function modelAccessName(messages: Message[]): string {
  return [...messages].reverse().find((message) => message.role === 'assistant')?.modelId ?? '';
}

function modelMaxForMessages(messages: Message[]): number | null {
  const model = modelAccessName(messages);
  if (model === '') {
    return null;
  }
  return getModelMaxTokens(model);
}

function targetTokenBudget(maxTokens: number, threshold: number): number {
  const thresholdTokens = maxTokens * threshold;
  const target = thresholdTokens - thresholdTokens * TARGET_REDUCTION_RATIO;
  const bounded = Math.min(target, maxTokens - RESPONSE_HEADROOM_TOKENS);
  return Math.max(MIN_TARGET_TOKEN_BUDGET, Math.floor(bounded));
}

function isLargeUncompressedMessage(messages: Message[], maxTokens: number): boolean {
  const threshold = Math.max(LARGE_MESSAGE_MIN_TOKENS, Math.floor(maxTokens * 0.1));
  return messages.some(
    (message) =>
      message.role === 'assistant' &&
      message.context?.compressedByPolicy === undefined &&
      messageTokens(message) >= threshold,
  );
}

async function summarizeForPolicy(
  threadId: string,
  prompt: string,
  options: SummarizeOptions,
): Promise<string> {
  if (window.electronAPI?.chat?.background === undefined) {
    return prompt.slice(0, 2000);
  }

  const request: BackgroundChatRequest = {
    taskType: ObserverTaskType.CompressContext,
    threadId,
    model: options.modelId,
    system:
      'Compress context content while preserving key facts, requirements, decisions, code references, and action items. Return plain condensed text only.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1200,
    temperature: 0.2,
  };

  try {
    const response = await window.electronAPI.chat.background(request);
    if (!response.success) {
      return prompt.slice(0, 2000);
    }
    const condensed = response.data.trim();
    return condensed === '' ? prompt.slice(0, 2000) : condensed;
  } catch {
    return prompt.slice(0, 2000);
  }
}

export const compressContextTask: ObserverTask = {
  taskType: ObserverTaskType.CompressContext,

  shouldRun(thread: ObserverThread, messages: Message[]): boolean {
    if (observerStore.getCurrentContext(thread.id) === undefined) {
      logInfo('[CompressContextTask] shouldRun passed', {
        threadId: thread.id,
        reason: 'no_current_context',
      });
      return true;
    }

    const maxTokens = modelMaxForMessages(messages);
    if (maxTokens === null) {
      return false;
    }

    const currentContext = observerStore.getCurrentContext(thread.id) ?? messages;
    const threshold = thresholdRatio();
    const isOverThreshold = totalTokens(currentContext) >= maxTokens * threshold;
    if (isOverThreshold) {
      logInfo('[CompressContextTask] shouldRun passed', {
        threadId: thread.id,
        reason: 'over_threshold',
        currentTokens: totalTokens(currentContext),
        thresholdTokens: Math.floor(maxTokens * threshold),
      });
      return true;
    }

    const hasLongMessage = isLargeUncompressedMessage(messages, maxTokens);
    if (hasLongMessage) {
      logInfo('[CompressContextTask] shouldRun passed', {
        threadId: thread.id,
        reason: 'large_uncompressed_message',
      });
    }

    return hasLongMessage;
  },

  async execute(thread: ObserverThread, messages: Message[]): Promise<void> {
    const maxTokens = modelMaxForMessages(messages);
    if (maxTokens === null) {
      observerStore.setCurrentContext(thread.id, messages);
      return;
    }

    const threshold = thresholdRatio();
    const target = targetTokenBudget(maxTokens, threshold);
    const startingTokens = totalTokens(messages);

    logInfo('[CompressContextTask] compression started', {
      threadId: thread.id,
      startingTokens,
      targetTokens: target,
      thresholdRatio: threshold,
    });

    const pipeline = new CompressionPipeline({
      maxContextTokens: maxTokens,
      reserveTokens: RESPONSE_HEADROOM_TOKENS,
      targetTokenCount: target,
      systemPrompt: '',
      estimateTokens: estimateTokensFromText,
      summarize: (prompt: string, options: SummarizeOptions) =>
        summarizeForPolicy(thread.id, prompt, options),
    })
      .use(new KeepRecentTurns(8))
      .use(new ProtectReferencedCode())
      .use(new DropRedundantMessages())
      .use(new CompressLongResponses())
      .use(new SummarizeOldTurns())
      .use(new AggressiveDropOldest());

    const result = await pipeline.compress(messages);
    const finalPercentOfStart =
      startingTokens > 0 ? (result.afterTokens / startingTokens) * 100 : 0;

    for (const stat of result.policyStats) {
      logInfo('[CompressContextTask] policy run', {
        threadId: thread.id,
        policy: stat.policy,
        beforeTokens: stat.beforeTokens,
        afterTokens: stat.afterTokens,
        tokenDelta: stat.tokenDelta,
        compressedMessageCount: stat.compressedMessageCount,
      });
    }

    logInfo('[CompressContextTask] compression completed', {
      threadId: thread.id,
      startingTokens,
      finalTokens: result.afterTokens,
      finalPercentOfStart: Number(finalPercentOfStart.toFixed(2)),
      totalCompressedMessages: result.policyStats.reduce(
        (sum, stat) => sum + stat.compressedMessageCount,
        0,
      ),
    });

    observerStore.setCurrentContext(thread.id, result.messages);
    observerStore.setLastCompactTimestamp(thread.id, Date.now());
    observerStore.setContextSummary(thread.id, {
      compressedAt: Date.now(),
      originalTokenCount: result.beforeTokens,
      compressedTokenCount: result.afterTokens,
      thresholdRatio: threshold,
      targetTokenCount: target,
      traces: result.traces,
    });
  },
};
