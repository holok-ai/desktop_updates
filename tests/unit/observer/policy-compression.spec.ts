import { describe, it, expect, vi } from 'vitest';
import type { Message } from '$lib/types/thread.type';
import type {
  CompressionContext,
  CompressionTrace,
  SummarizeOptions,
} from '$lib/observer/tasks/policy';
import {
  KeepRecentTurns,
  ProtectReferencedCode,
  DropRedundantMessages,
  CompressLongResponses,
  SummarizeOldTurns,
  AggressiveDropOldest,
} from '$lib/observer/tasks/policy';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    threadId: overrides.threadId ?? 'thread-1',
    branchId: overrides.branchId ?? '1.0.0',
    role: overrides.role ?? 'user',
    content: overrides.content ?? 'hello',
    createdAt: overrides.createdAt ?? Date.now(),
    guardExecution: overrides.guardExecution ?? 'none',
    guardMessageId: overrides.guardMessageId ?? null,
    guardError: overrides.guardError ?? '',
    modelId: overrides.modelId,
    tokens: overrides.tokens,
    context: overrides.context,
  };
}

function makeContext(overrides: Partial<CompressionContext> = {}): {
  context: CompressionContext;
  traces: CompressionTrace[];
} {
  const traces: CompressionTrace[] = [];

  const summarize =
    overrides.summarize ??
    (async (_prompt: string, options: SummarizeOptions): Promise<string> => {
      return `summary:${options.sourceMessageIds.join(',')}`;
    });

  const context: CompressionContext = {
    maxContextTokens: overrides.maxContextTokens ?? 16000,
    currentTokenCount: overrides.currentTokenCount ?? 10000,
    systemPromptTokens: overrides.systemPromptTokens ?? 50,
    historyBudget: overrides.historyBudget ?? 11000,
    reserveTokens: overrides.reserveTokens ?? 2000,
    targetTokenCount: overrides.targetTokenCount ?? 8000,
    estimateTokens:
      overrides.estimateTokens ?? ((text: string) => Math.max(1, Math.ceil(text.length / 4))),
    summarize,
    recordTrace: overrides.recordTrace ?? ((trace: CompressionTrace) => traces.push(trace)),
  };

  return { context, traces };
}

describe('Compression policies', () => {
  it('KeepRecentTurns marks recent turn pair as protected', async () => {
    const policy = new KeepRecentTurns(1);
    const { context } = makeContext();
    const messages = [
      makeMessage({
        id: 'm1',
        role: 'user',
        content: 'older user',
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'm2',
        role: 'assistant',
        content: 'older assistant',
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'm3',
        role: 'user',
        content: 'newer user',
        context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'm4',
        role: 'assistant',
        content: 'newer assistant',
        context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
      }),
    ];

    const updated = await policy.apply(messages, context);

    expect(updated[0]?.context?.isProtected).toBe(false);
    expect(updated[1]?.context?.isProtected).toBe(false);
    expect(updated[2]?.context?.isProtected).toBe(true);
    expect(updated[3]?.context?.isProtected).toBe(true);
  });

  it('ProtectReferencedCode protects older code blocks referenced by protected messages', async () => {
    const policy = new ProtectReferencedCode();
    const { context } = makeContext();
    const messages = [
      makeMessage({
        id: 'old-code',
        role: 'assistant',
        content: '```ts\nfunction processOrder() { return true; }\n```',
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: true },
      }),
      makeMessage({
        id: 'recent-ref',
        role: 'user',
        content: 'Please update processOrder() in the old snippet.',
        context: { turnIndex: 1, isProtected: true, hasCodeBlock: false },
      }),
    ];

    const updated = await policy.apply(messages, context);

    expect(updated[0]?.context?.isProtected).toBe(true);
  });

  it('DropRedundantMessages removes cordiality pair', async () => {
    const policy = new DropRedundantMessages();
    const { context } = makeContext({ currentTokenCount: 9000, targetTokenCount: 8000 });
    const messages = [
      makeMessage({
        id: 'u1',
        role: 'user',
        content: 'thanks',
        tokens: 5,
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'a1',
        role: 'assistant',
        content: 'ok',
        tokens: 4,
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'u2',
        role: 'user',
        content: 'real question',
        tokens: 50,
        context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'a2',
        role: 'assistant',
        content: 'real answer',
        tokens: 60,
        context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
      }),
    ];

    const updated = await policy.apply(messages, context);

    expect(updated.map((message) => message.id)).toEqual(['u2', 'a2']);
  });

  it('CompressLongResponses compresses largest messages first', async () => {
    const summarizeOrder: string[] = [];
    const summarizePrompts: string[] = [];
    const policy = new CompressLongResponses(100, 0.3);
    const { context, traces } = makeContext({
      currentTokenCount: 12000,
      targetTokenCount: 6000,
      summarize: async (prompt: string, options: SummarizeOptions): Promise<string> => {
        summarizePrompts.push(prompt);
        summarizeOrder.push(options.sourceMessageIds[0] ?? '');
        return `condensed:${options.sourceMessageIds[0] ?? ''}`;
      },
      estimateTokens: (text: string) => Math.max(1, Math.ceil(text.length / 10)),
    });

    const messages = [
      makeMessage({
        id: 'small',
        role: 'assistant',
        content: 'short',
        tokens: 50,
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'mid',
        role: 'assistant',
        content: 'm'.repeat(800),
        tokens: 180,
        context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'u-big',
        role: 'user',
        content: 'Please summarize this answer but keep key facts.',
        tokens: 40,
        context: { turnIndex: 2, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'big',
        role: 'assistant',
        content: 'b'.repeat(2000),
        tokens: 400,
        context: { turnIndex: 2, isProtected: false, hasCodeBlock: false },
      }),
    ];

    const updated = await policy.apply(messages, context);

    expect(summarizeOrder[0]).toBe('u-big');
    expect(updated.find((message) => message.id === 'big')?.context?.compressedByPolicy).toBe(
      'CompressLongResponses',
    );
    expect(traces.some((trace) => trace.sourceMessageIds.includes('big'))).toBe(true);
    expect(summarizePrompts[0]).toContain('USER REQUEST');
  });

  it('CompressLongResponses still runs when under target if long message exists', async () => {
    const policy = new CompressLongResponses(100, 0.3);
    const { context } = makeContext({
      currentTokenCount: 5000,
      targetTokenCount: 8000,
      summarize: async (): Promise<string> => 'short summary',
      estimateTokens: () => 20,
    });

    const messages = [
      makeMessage({
        id: 'long-under-target',
        role: 'assistant',
        content: 'x'.repeat(2000),
        tokens: 300,
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
    ];

    expect(policy.shouldRun(messages, context)).toBe(true);
    const updated = await policy.apply(messages, context);
    expect(updated[0]?.context?.compressedByPolicy).toBe('CompressLongResponses');
  });

  it('SummarizeOldTurns summarizes 3 old turns into one summary block', async () => {
    const policy = new SummarizeOldTurns(6);
    const summarizeMock = vi.fn(async (): Promise<string> => 'old turns summary');
    const { context, traces } = makeContext({
      currentTokenCount: 12000,
      targetTokenCount: 6000,
      summarize: summarizeMock,
      estimateTokens: (text: string) => Math.max(1, Math.ceil(text.length / 8)),
    });

    const oldTurns = [
      makeMessage({
        id: 'u1',
        role: 'user',
        tokens: 120,
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'a1',
        role: 'assistant',
        tokens: 160,
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'u2',
        role: 'user',
        tokens: 130,
        context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'a2',
        role: 'assistant',
        tokens: 170,
        context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'u3',
        role: 'user',
        tokens: 140,
        context: { turnIndex: 2, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'a3',
        role: 'assistant',
        tokens: 180,
        context: { turnIndex: 2, isProtected: false, hasCodeBlock: false },
      }),
    ];

    const protectedRecent = [
      makeMessage({
        id: 'u4',
        role: 'user',
        tokens: 100,
        context: { turnIndex: 3, isProtected: true, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'a4',
        role: 'assistant',
        tokens: 120,
        context: { turnIndex: 3, isProtected: true, hasCodeBlock: false },
      }),
    ];

    const updated = await policy.apply([...oldTurns, ...protectedRecent], context);

    const summaryBlocks = updated.filter(
      (message) => message.context?.compressedByPolicy === 'SummarizeOldTurns',
    );
    expect(summaryBlocks).toHaveLength(1);
    expect(summaryBlocks[0]?.context?.sourceMessageIds).toEqual([
      'u1',
      'a1',
      'u2',
      'a2',
      'u3',
      'a3',
    ]);
    expect(updated.map((message) => message.id)).toContain('u4');
    expect(updated.map((message) => message.id)).toContain('a4');
    expect(summarizeMock).toHaveBeenCalledTimes(1);
    expect(traces).toHaveLength(1);
    expect(traces[0]?.policy).toBe('SummarizeOldTurns');
  });

  it('SummarizeOldTurns excludes trailing user-only turn from summary input', async () => {
    const policy = new SummarizeOldTurns(4);
    const summarizeMock = vi.fn(async (): Promise<string> => 'paired summary');
    const { context } = makeContext({
      currentTokenCount: 12000,
      targetTokenCount: 6000,
      summarize: summarizeMock,
    });

    const messages = [
      makeMessage({
        id: 'u1',
        role: 'user',
        content: 'first',
        tokens: 120,
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'a1',
        role: 'assistant',
        content: 'first response',
        tokens: 140,
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'u2',
        role: 'user',
        content: 'second',
        tokens: 130,
        context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'a2',
        role: 'assistant',
        content: 'second response',
        tokens: 150,
        context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'u-open',
        role: 'user',
        content: 'open turn without response',
        tokens: 100,
        context: { turnIndex: 2, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'u3',
        role: 'user',
        content: 'protected user',
        tokens: 110,
        context: { turnIndex: 3, isProtected: true, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'a3',
        role: 'assistant',
        content: 'protected response',
        tokens: 120,
        context: { turnIndex: 3, isProtected: true, hasCodeBlock: false },
      }),
    ];

    const updated = await policy.apply(messages, context);

    expect(summarizeMock).toHaveBeenCalledTimes(1);
    const summarizeOptions = summarizeMock.mock.calls[0]?.[1] as SummarizeOptions;
    expect(summarizeOptions.sourceMessageIds).toEqual(['u1', 'a1', 'u2', 'a2']);
    const summarizedIds = updated.find(
      (message) => message.context?.compressedByPolicy === 'SummarizeOldTurns',
    )?.context?.sourceMessageIds;
    expect(summarizedIds).toEqual(['u1', 'a1', 'u2', 'a2']);
    expect(updated.map((message) => message.id)).toContain('u-open');
  });

  it('AggressiveDropOldest drops oldest unprotected pairs until under target', async () => {
    const policy = new AggressiveDropOldest();
    const { context } = makeContext({ currentTokenCount: 1000, targetTokenCount: 350 });
    const messages = [
      makeMessage({
        id: 'u1',
        role: 'user',
        tokens: 200,
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'a1',
        role: 'assistant',
        tokens: 200,
        context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'u2',
        role: 'user',
        tokens: 150,
        context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: 'a2',
        role: 'assistant',
        tokens: 150,
        context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
      }),
    ];

    const updated = await policy.apply(messages, context);

    expect(updated.length).toBeLessThan(messages.length);
    expect(updated.map((message) => message.id)).toEqual(['u2', 'a2']);
  });
});
