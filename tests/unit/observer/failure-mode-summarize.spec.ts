import { describe, it, expect, vi } from 'vitest';
import type { Message } from '$lib/types/thread.type';
import type {
  CompressionContext,
  CompressionTrace,
  SummarizeOptions,
} from '$lib/observer/tasks/policy';
import { FailureModeSummarize } from '$lib/observer/tasks/policy';

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
    currentTokenCount: overrides.currentTokenCount ?? 20000,
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

/** Build a multi-turn conversation with the given number of turns */
function makeTurns(count: number, tokensPerMessage: number = 500): Message[] {
  const messages: Message[] = [];
  for (let i = 0; i < count; i++) {
    messages.push(
      makeMessage({
        id: `u${i}`,
        role: 'user',
        content: `user message ${i}`,
        tokens: tokensPerMessage,
        context: { turnIndex: i, isProtected: false, hasCodeBlock: false },
      }),
      makeMessage({
        id: `a${i}`,
        role: 'assistant',
        content: `assistant response ${i}`,
        tokens: tokensPerMessage,
        modelId: 'test-model',
        context: { turnIndex: i, isProtected: false, hasCodeBlock: false },
      }),
    );
  }
  return messages;
}

describe('FailureModeSummarize', () => {
  describe('shouldRun', () => {
    it('returns true when currentTokenCount exceeds maxContextTokens', () => {
      const policy = new FailureModeSummarize();
      const { context } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
      });

      expect(policy.shouldRun([], context)).toBe(true);
    });

    it('returns false when currentTokenCount is within maxContextTokens', () => {
      const policy = new FailureModeSummarize();
      const { context } = makeContext({
        currentTokenCount: 10000,
        maxContextTokens: 16000,
      });

      expect(policy.shouldRun([], context)).toBe(false);
    });

    it('returns false when currentTokenCount equals maxContextTokens', () => {
      const policy = new FailureModeSummarize();
      const { context } = makeContext({
        currentTokenCount: 16000,
        maxContextTokens: 16000,
      });

      expect(policy.shouldRun([], context)).toBe(false);
    });
  });

  describe('apply — no user messages', () => {
    it('returns messages unchanged when there are no user messages', async () => {
      const policy = new FailureModeSummarize();
      const { context } = makeContext();
      const messages = [
        makeMessage({ id: 'sys', role: 'system', content: 'system prompt', tokens: 100 }),
        makeMessage({ id: 'a1', role: 'assistant', content: 'response', tokens: 500 }),
      ];

      const result = await policy.apply(messages, context);

      expect(result).toEqual(messages);
    });
  });

  describe('Strategy 1 — summarize oldest N-1 of last N turns', () => {
    it('summarizes oldest 2 turns and keeps newest turn when 3 turns exist', async () => {
      const policy = new FailureModeSummarize(8);
      const summarizeMock = vi.fn(async (): Promise<string> => 'condensed old turns');
      const { context, traces } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
        summarize: summarizeMock,
        // Make summary tokens small enough to go under limit
        estimateTokens: () => 100,
      });

      const messages = [
        makeMessage({ id: 'sys', role: 'system', content: 'system', tokens: 50 }),
        ...makeTurns(3, 5000),
      ];

      const result = await policy.apply(messages, context);

      // summarize was called once (strategy 1 sufficed)
      expect(summarizeMock).toHaveBeenCalledTimes(1);

      // The summary should cover turns 0 and 1 (oldest 2)
      const options = summarizeMock.mock.calls[0]?.[1] as SummarizeOptions;
      expect(options.sourceMessageIds).toEqual(['u0', 'a0', 'u1', 'a1']);
      expect(options.policy).toBe('FailureModeSummarize');

      // Result should have: system + summary + last turn (u2, a2)
      expect(result).toHaveLength(4); // system, summary, u2, a2
      expect(result[0]?.role).toBe('system');

      const summary = result[1];
      expect(summary?.content).toContain('[CONVERSATION SUMMARY]');
      expect(summary?.context?.compressedByPolicy).toBe('FailureModeSummarize');
      expect(summary?.context?.sourceMessageIds).toEqual(['u0', 'a0', 'u1', 'a1']);

      // Last turn kept intact
      expect(result[2]?.id).toBe('u2');
      expect(result[3]?.id).toBe('a2');

      // Trace recorded
      expect(traces).toHaveLength(1);
      expect(traces[0]?.policy).toBe('FailureModeSummarize');
    });

    it('summarizes oldest 7 of 8 turns when protectedTurnCount is 8', async () => {
      const policy = new FailureModeSummarize(8);
      const summarizeMock = vi.fn(async (): Promise<string> => 'big summary');
      const { context } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
        summarize: summarizeMock,
        estimateTokens: () => 50,
      });

      const messages = makeTurns(8, 1200);

      const result = await policy.apply(messages, context);

      // Strategy 1 should summarize oldest 7 turns
      expect(summarizeMock).toHaveBeenCalledTimes(1);
      const options = summarizeMock.mock.calls[0]?.[1] as SummarizeOptions;
      expect(options.sourceMessageIds).toHaveLength(14); // 7 turns * 2 messages each
      expect(options.sourceMessageIds).toContain('u0');
      expect(options.sourceMessageIds).toContain('a6');
      expect(options.sourceMessageIds).not.toContain('u7');
      expect(options.sourceMessageIds).not.toContain('a7');

      // Last turn (turn 7) kept intact
      const ids = result.map((m) => m.id);
      expect(ids).toContain('u7');
      expect(ids).toContain('a7');
    });

    it('preserves head messages that precede the tail window', async () => {
      const policy = new FailureModeSummarize(3); // only look at last 3 turns
      const summarizeMock = vi.fn(async (): Promise<string> => 'tail summary');
      const { context } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
        summarize: summarizeMock,
        estimateTokens: () => 50,
      });

      // 5 turns total, protectedTurnCount=3, so head=turns 0-1, tail=turns 2-4
      const messages = makeTurns(5, 1000);

      const result = await policy.apply(messages, context);

      expect(summarizeMock).toHaveBeenCalledTimes(1);

      // Oldest 2 of the 3 tail turns summarized (turns 2 and 3)
      const options = summarizeMock.mock.calls[0]?.[1] as SummarizeOptions;
      expect(options.sourceMessageIds).toEqual(['u2', 'a2', 'u3', 'a3']);

      // Head messages (turns 0-1) preserved
      const ids = result.map((m) => m.id);
      expect(ids).toContain('u0');
      expect(ids).toContain('a0');
      expect(ids).toContain('u1');
      expect(ids).toContain('a1');

      // Last turn (turn 4) kept
      expect(ids).toContain('u4');
      expect(ids).toContain('a4');
    });

    it('returns unchanged when only 1 turn exists (nothing to summarize)', async () => {
      const policy = new FailureModeSummarize();
      const summarizeMock = vi.fn(async (): Promise<string> => 'should not be called');
      // Set up so strategy 1 returns unchanged, then strategy 2 will fire
      // But since there's only 1 turn, strategy 2 will compress it
      const { context } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
        summarize: summarizeMock,
        estimateTokens: () => 50,
      });

      const messages = [
        makeMessage({ id: 'sys', role: 'system', content: 'system', tokens: 50 }),
        makeMessage({
          id: 'u0',
          role: 'user',
          content: 'big question',
          tokens: 5000,
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a0',
          role: 'assistant',
          content: 'big answer',
          tokens: 15000,
          modelId: 'test-model',
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
      ];

      const result = await policy.apply(messages, context);

      // Strategy 1 skipped (only 1 turn), strategy 2 fired
      expect(summarizeMock).toHaveBeenCalledTimes(1);
      const options = summarizeMock.mock.calls[0]?.[1] as SummarizeOptions;
      expect(options.sourceMessageIds).toEqual(['u0', 'a0']);
    });
  });

  describe('Strategy 2 — summarize last turn when still over limit', () => {
    it('fires strategy 2 when strategy 1 result is still over maxContextTokens', async () => {
      const policy = new FailureModeSummarize(8);
      let callCount = 0;
      const summarizeMock = vi.fn(
        async (_prompt: string, options: SummarizeOptions): Promise<string> => {
          callCount++;
          if (callCount === 1) {
            // Strategy 1 summary — still large
            return 'strategy 1 summary';
          }
          // Strategy 2 summary — small
          return 'strategy 2 summary';
        },
      );

      const { context, traces } = makeContext({
        currentTokenCount: 100000,
        maxContextTokens: 1000,
        summarize: summarizeMock,
        // Strategy 1 summary will be estimated at ~5 tokens (small),
        // but the last turn has 80000 tokens, pushing total over limit.
        // Strategy 2 summary will also be small.
        estimateTokens: (text: string) => Math.max(1, Math.ceil(text.length / 4)),
      });

      const messages = [
        makeMessage({ id: 'sys', role: 'system', content: 'sys', tokens: 50 }),
        makeMessage({
          id: 'u0',
          role: 'user',
          content: 'old question',
          tokens: 200,
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a0',
          role: 'assistant',
          content: 'old answer',
          tokens: 200,
          modelId: 'model-a',
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'u1',
          role: 'user',
          content: 'big question',
          tokens: 20000,
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a1',
          role: 'assistant',
          content: 'x'.repeat(240000), // huge response
          tokens: 80000,
          modelId: 'model-b',
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
      ];

      const result = await policy.apply(messages, context);

      // Both strategies fired
      expect(summarizeMock).toHaveBeenCalledTimes(2);

      // Strategy 1 call: summarized turn 0 (oldest of 2)
      const s1Options = summarizeMock.mock.calls[0]?.[1] as SummarizeOptions;
      expect(s1Options.sourceMessageIds).toEqual(['u0', 'a0']);

      // Strategy 2 call: summarized the last turn (u1 + a1)
      const s2Options = summarizeMock.mock.calls[1]?.[1] as SummarizeOptions;
      expect(s2Options.sourceMessageIds).toEqual(['u1', 'a1']);
      expect(s2Options.modelId).toBe('model-b');

      // Final result: system + strategy1 summary + strategy2 summary
      expect(result).toHaveLength(3);
      expect(result[0]?.role).toBe('system');

      // Both summaries should be marked
      const summaries = result.filter(
        (m) => m.context?.compressedByPolicy === 'FailureModeSummarize',
      );
      expect(summaries).toHaveLength(2);

      // Two traces recorded
      expect(traces).toHaveLength(2);
    });

    it('picks the assistant modelId from the last turn for strategy 2', async () => {
      const policy = new FailureModeSummarize(8);
      let callCount = 0;
      const summarizeMock = vi.fn(async (): Promise<string> => {
        callCount++;
        return `summary ${callCount}`;
      });

      const { context } = makeContext({
        currentTokenCount: 50000,
        maxContextTokens: 500,
        summarize: summarizeMock,
        estimateTokens: () => 10,
      });

      const messages = [
        makeMessage({
          id: 'u0',
          role: 'user',
          tokens: 100,
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a0',
          role: 'assistant',
          tokens: 100,
          modelId: 'gpt-5.2-chat',
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'u1',
          role: 'user',
          tokens: 20000,
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a1',
          role: 'assistant',
          tokens: 30000,
          modelId: 'gpt-5.1-codex',
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
      ];

      await policy.apply(messages, context);

      // Strategy 2 should use modelId from the last turn's assistant
      expect(summarizeMock).toHaveBeenCalledTimes(2);
      const s2Options = summarizeMock.mock.calls[1]?.[1] as SummarizeOptions;
      expect(s2Options.modelId).toBe('gpt-5.1-codex');
    });
  });

  describe('summary message shape', () => {
    it('creates summary with correct metadata', async () => {
      const policy = new FailureModeSummarize(8);
      const { context } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
        summarize: async (): Promise<string> => 'the summary text',
        estimateTokens: () => 25,
      });

      const messages = makeTurns(3, 5000);

      const result = await policy.apply(messages, context);
      const summary = result.find((m) => m.context?.compressedByPolicy === 'FailureModeSummarize');

      expect(summary).toBeDefined();
      expect(summary?.role).toBe('assistant');
      expect(summary?.content).toBe('[CONVERSATION SUMMARY]\nthe summary text');
      expect(summary?.tokens).toBe(25);
      expect(summary?.id).toMatch(/^failure-summary-\d+$/);
      expect(summary?.context?.isProtected).toBe(false);
      expect(summary?.context?.compressedTokenSize).toBe(25);
      expect(summary?.context?.originalTokenSize).toBe(20000); // 4 messages * 5000 tokens
    });

    it('detects code blocks in summary content', async () => {
      const policy = new FailureModeSummarize(8);
      const { context } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
        summarize: async (): Promise<string> => 'here is code:\n```ts\nconst x = 1;\n```',
        estimateTokens: () => 30,
      });

      const messages = makeTurns(3, 5000);

      const result = await policy.apply(messages, context);
      const summary = result.find((m) => m.context?.compressedByPolicy === 'FailureModeSummarize');

      expect(summary?.context?.hasCodeBlock).toBe(true);
    });

    it('sets hasCodeBlock false when no code blocks in summary', async () => {
      const policy = new FailureModeSummarize(8);
      const { context } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
        summarize: async (): Promise<string> => 'plain text summary',
        estimateTokens: () => 10,
      });

      const messages = makeTurns(3, 5000);

      const result = await policy.apply(messages, context);
      const summary = result.find((m) => m.context?.compressedByPolicy === 'FailureModeSummarize');

      expect(summary?.context?.hasCodeBlock).toBe(false);
    });
  });

  describe('system messages', () => {
    it('preserves system messages through strategy 1', async () => {
      const policy = new FailureModeSummarize(8);
      const { context } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
        summarize: async (): Promise<string> => 'summary',
        estimateTokens: () => 10,
      });

      const messages = [
        makeMessage({ id: 'sys1', role: 'system', content: 'system prompt', tokens: 100 }),
        makeMessage({ id: 'sys2', role: 'system', content: 'system context', tokens: 50 }),
        ...makeTurns(3, 3000),
      ];

      const result = await policy.apply(messages, context);
      const systemMsgs = result.filter((m) => m.role === 'system');

      expect(systemMsgs).toHaveLength(2);
      expect(systemMsgs[0]?.id).toBe('sys1');
      expect(systemMsgs[1]?.id).toBe('sys2');
    });

    it('preserves system messages through strategy 2', async () => {
      const policy = new FailureModeSummarize(8);
      let callCount = 0;
      const { context } = makeContext({
        currentTokenCount: 100000,
        maxContextTokens: 500,
        summarize: async (): Promise<string> => {
          callCount++;
          return `summary ${callCount}`;
        },
        estimateTokens: () => 10,
      });

      const messages = [
        makeMessage({ id: 'sys', role: 'system', content: 'system', tokens: 50 }),
        makeMessage({
          id: 'u0',
          role: 'user',
          tokens: 200,
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a0',
          role: 'assistant',
          tokens: 200,
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'u1',
          role: 'user',
          tokens: 50000,
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a1',
          role: 'assistant',
          tokens: 50000,
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
      ];

      const result = await policy.apply(messages, context);
      const systemMsgs = result.filter((m) => m.role === 'system');

      expect(systemMsgs).toHaveLength(1);
      expect(systemMsgs[0]?.id).toBe('sys');
    });
  });

  describe('buildPrompt', () => {
    it('sends conversation content to summarize function as JSON', async () => {
      const policy = new FailureModeSummarize(8);
      let capturedPrompt = '';
      const { context } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
        summarize: async (prompt: string): Promise<string> => {
          capturedPrompt = prompt;
          return 'summary';
        },
        estimateTokens: () => 10,
      });

      const messages = [
        makeMessage({
          id: 'u0',
          role: 'user',
          content: 'what is 2+2?',
          tokens: 5000,
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a0',
          role: 'assistant',
          content: 'it is 4',
          tokens: 5000,
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'u1',
          role: 'user',
          content: 'thanks',
          tokens: 5000,
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a1',
          role: 'assistant',
          content: 'welcome',
          tokens: 5000,
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
      ];

      await policy.apply(messages, context);

      expect(capturedPrompt).toContain('CONVERSATION_TURNS_JSON');
      expect(capturedPrompt).toContain('what is 2+2?');
      expect(capturedPrompt).toContain('it is 4');
      // Strategy 1 summarizes oldest turn (turn 0), NOT the last turn
      expect(capturedPrompt).not.toContain('thanks');
    });
  });

  describe('edge cases', () => {
    it('handles assistant-only messages before the first user turn', async () => {
      const policy = new FailureModeSummarize(8);
      const summarizeMock = vi.fn(async (): Promise<string> => 'summary');
      const { context } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
        summarize: summarizeMock,
        estimateTokens: () => 10,
      });

      const messages = [
        makeMessage({
          id: 'greeting',
          role: 'assistant',
          content: 'Hello! How can I help?',
          tokens: 100,
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'u0',
          role: 'user',
          content: 'question 1',
          tokens: 3000,
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a0',
          role: 'assistant',
          content: 'answer 1',
          tokens: 3000,
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'u1',
          role: 'user',
          content: 'question 2',
          tokens: 7000,
          context: { turnIndex: 2, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a1',
          role: 'assistant',
          content: 'answer 2',
          tokens: 7000,
          context: { turnIndex: 2, isProtected: false, hasCodeBlock: false },
        }),
      ];

      const result = await policy.apply(messages, context);

      // Should not crash; the greeting forms its own "turn" in groupByTurns
      expect(summarizeMock).toHaveBeenCalled();
      // Last turn (u1, a1) should be kept
      const ids = result.map((m) => m.id);
      expect(ids).toContain('u1');
      expect(ids).toContain('a1');
    });

    it('custom protectedTurnCount of 4 takes last 4 turns', async () => {
      const policy = new FailureModeSummarize(4);
      const summarizeMock = vi.fn(async (): Promise<string> => 'summary');
      const { context } = makeContext({
        currentTokenCount: 20000,
        maxContextTokens: 16000,
        summarize: summarizeMock,
        estimateTokens: () => 10,
      });

      const messages = makeTurns(6, 1500);

      const result = await policy.apply(messages, context);

      // Strategy 1: last 4 turns (2-5), summarize turns 2-4, keep turn 5
      expect(summarizeMock).toHaveBeenCalledTimes(1);
      const options = summarizeMock.mock.calls[0]?.[1] as SummarizeOptions;
      expect(options.sourceMessageIds).toEqual(['u2', 'a2', 'u3', 'a3', 'u4', 'a4']);

      // Head turns (0-1) preserved, last turn (5) preserved
      const ids = result.map((m) => m.id);
      expect(ids).toContain('u0');
      expect(ids).toContain('a1');
      expect(ids).toContain('u5');
      expect(ids).toContain('a5');
    });

    it('strategy 1 returns unchanged for 1 turn, then strategy 2 compresses it', async () => {
      const policy = new FailureModeSummarize(8);
      const summarizeMock = vi.fn(async (): Promise<string> => 'compressed single turn');
      const { context } = makeContext({
        currentTokenCount: 50000,
        maxContextTokens: 1000,
        summarize: summarizeMock,
        estimateTokens: () => 20,
      });

      const messages = [
        makeMessage({
          id: 'u0',
          role: 'user',
          content: 'very long question',
          tokens: 20000,
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a0',
          role: 'assistant',
          content: 'very long answer',
          tokens: 30000,
          modelId: 'big-model',
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
      ];

      const result = await policy.apply(messages, context);

      // Strategy 1 returned unchanged (1 turn), strategy 2 fired
      expect(summarizeMock).toHaveBeenCalledTimes(1);
      const options = summarizeMock.mock.calls[0]?.[1] as SummarizeOptions;
      expect(options.sourceMessageIds).toEqual(['u0', 'a0']);
      expect(options.modelId).toBe('big-model');

      // Result is just the summary
      expect(result).toHaveLength(1);
      expect(result[0]?.content).toContain('[CONVERSATION SUMMARY]');
      expect(result[0]?.tokens).toBe(20);
    });

    it('two turns where both strategies fire in sequence', async () => {
      const policy = new FailureModeSummarize(8);
      const calls: string[][] = [];
      const summarizeMock = vi.fn(async (_p: string, opts: SummarizeOptions): Promise<string> => {
        calls.push([...opts.sourceMessageIds]);
        return 'small summary';
      });
      const { context, traces } = makeContext({
        currentTokenCount: 100000,
        // Very small limit forces both strategies
        maxContextTokens: 100,
        summarize: summarizeMock,
        estimateTokens: () => 10,
      });

      const messages = [
        makeMessage({
          id: 'u0',
          role: 'user',
          tokens: 30000,
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a0',
          role: 'assistant',
          tokens: 30000,
          context: { turnIndex: 0, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'u1',
          role: 'user',
          tokens: 20000,
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
        makeMessage({
          id: 'a1',
          role: 'assistant',
          tokens: 20000,
          context: { turnIndex: 1, isProtected: false, hasCodeBlock: false },
        }),
      ];

      const result = await policy.apply(messages, context);

      // Call 1 (strategy 1): summarize oldest turn (u0, a0)
      expect(calls[0]).toEqual(['u0', 'a0']);
      // Call 2 (strategy 2): summarize last turn (u1, a1)
      expect(calls[1]).toEqual(['u1', 'a1']);

      // Final: 2 summaries
      expect(result).toHaveLength(2);
      expect(traces).toHaveLength(2);
    });
  });

  describe('priority and name', () => {
    it('has priority 500', () => {
      const policy = new FailureModeSummarize();
      expect(policy.priority).toBe(500);
    });

    it('is named FailureModeSummarize', () => {
      const policy = new FailureModeSummarize();
      expect(policy.name).toBe('FailureModeSummarize');
    });
  });
});
