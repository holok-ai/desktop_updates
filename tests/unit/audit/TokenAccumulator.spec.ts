import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TokenAccumulator', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('accumulates tokens, calls original callback and generates audit data with tokensPerSecond', async () => {
    // Mock TokenCounters to return predictable counts
    vi.doMock('../../../src-electron/services/chat/audit/TokenCounters', () => ({
      getTokenCounter: () => ({
        countPromptTokens: (_p: unknown[]) => 5,
        estimateResponseTokens: (s: string) => (s ? 3 : 0),
      }),
    }));

    // Control Date.now sequence: constructor, first token, complete
    const times = [1000, 1100, 2100];
    vi.spyOn(Date, 'now').mockImplementation(() => times.shift() as number);

    const { TokenAccumulator } = await import(
      '../../../src-electron/services/chat/audit/TokenAccumulator'
    );

    const onComplete = vi.fn();
    const originalTokenCb = vi.fn();

    const acc = new TokenAccumulator(
      'claude',
      'm',
      [{ role: 'user', content: 'hi' }],
      onComplete,
      originalTokenCb,
    );

    acc.handleToken('a');
    acc.handleToken('b');

    const result = acc.complete();

    // original callback invoked per token
    expect(originalTokenCb).toHaveBeenCalledTimes(2);
    // prompt/completion counts from mocked token counter
    expect(result.promptTokenCount).toBe(5);
    expect(result.completionTokenCount).toBe(3);
    expect(result.totalTokenCount).toBe(8);
    // tokensReceived was 2 and streaming duration = (2100-1100)/1000 = 1 -> tps = 2
    expect(result.tokensPerSecond).toBeCloseTo(2);
    expect(onComplete).toHaveBeenCalledWith(result);
  });

  it('returns undefined tokensPerSecond when no tokens received or zero streaming duration', async () => {
    vi.doMock('../../../src-electron/services/chat/audit/TokenCounters', () => ({
      getTokenCounter: () => ({ countPromptTokens: () => 0, estimateResponseTokens: () => 0 }),
    }));

    // Date.now: constructor only and complete time equal to start (no tokens)
    const times = [2000, 2000];
    vi.spyOn(Date, 'now').mockImplementation(() => times.shift() as number);

    const { TokenAccumulator } = await import(
      '../../../src-electron/services/chat/audit/TokenAccumulator'
    );

    const onComplete = vi.fn();
    const acc = new TokenAccumulator('openai', 'm', [], onComplete);

    const result = acc.complete();

    expect(result.tokensPerSecond).toBeUndefined();
    expect(result.firstTokenTimestamp).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it('formats error correctly for Error, string and object types', async () => {
    vi.doMock('../../../src-electron/services/chat/audit/TokenCounters', () => ({
      getTokenCounter: () => ({ countPromptTokens: () => 0, estimateResponseTokens: () => 0 }),
    }));

    const nowVal = 3000;
    vi.spyOn(Date, 'now').mockImplementation(() => nowVal);

    const { TokenAccumulator } = await import(
      '../../../src-electron/services/chat/audit/TokenAccumulator'
    );

    const onComplete = vi.fn();
    const acc1 = new TokenAccumulator('x', 'm', [], onComplete);
    const res1 = acc1.complete(new Error('boom'));
    expect(res1.error).toBe('boom');

    const acc2 = new TokenAccumulator('x', 'm', [], onComplete);
    const res2 = acc2.complete('plain error');
    expect(res2.error).toBe('plain error');

    const acc3 = new TokenAccumulator('x', 'm', [], onComplete);
    const objErr = { a: 1 };
    const res3 = acc3.complete(objErr);
    expect(res3.error).toBe(JSON.stringify(objErr));
  });
});
