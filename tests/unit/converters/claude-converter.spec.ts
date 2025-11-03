import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ClaudeConverter } from '../../../src-electron/services/chat/converters/claudeConverter';

describe('ClaudeConverter', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('maps roles correctly and preserves content', () => {
    const req = {
      model: 'm',
      messages: [
        { role: 'assistant', content: 'a' },
        { role: 'user', content: 'b' },
        { role: 'system', content: 'c' },
        { role: 'unknown', content: 'd' },
      ],
      streaming: true,
    } as any;

    const out = ClaudeConverter.toClaudeRequest(req);
    expect(out.model).toBe('m');
    expect(out.stream).toBe(true);
    expect(out.messages.map((m: any) => m.role)).toEqual(['assistant', 'user', 'user', 'user']);
    expect(out.messages.map((m: any) => m.content)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('defaults stream to true when streaming omitted or true, and false when explicitly false', () => {
    const r1 = { model: 'm', messages: [], streaming: undefined } as any;
    expect(ClaudeConverter.toClaudeRequest(r1).stream).toBe(true);

    const r2 = { model: 'm', messages: [], streaming: true } as any;
    expect(ClaudeConverter.toClaudeRequest(r2).stream).toBe(true);

    const r3 = { model: 'm', messages: [], streaming: false } as any;
    expect(ClaudeConverter.toClaudeRequest(r3).stream).toBe(false);
  });

  it('includes optional parameters when provided in toClaudeRequestWithOptions', () => {
    const req = {
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      streaming: false,
      options: {
        temperature: 0.7,
        maxTokens: 150,
        topP: 0.9,
        stop: ['\n', '###'],
      },
    } as any;

    const out = ClaudeConverter.toClaudeRequestWithOptions(req);
    expect(out.model).toBe('m');
    expect((out as any).temperature).toBe(0.7);
    expect((out as any).max_tokens).toBe(150);
    expect((out as any).top_p).toBe(0.9);
    expect((out as any).stop_sequences).toEqual(['\n', '###']);
    expect((out as any).stream).toBe(false);
  });

  it('omits optional parameters when undefined', () => {
    const req = {
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      streaming: true,
      options: {},
    } as any;

    const out = ClaudeConverter.toClaudeRequestWithOptions(req);
    expect(out.model).toBe('m');
    expect((out as any).temperature).toBeUndefined();
    expect((out as any).max_tokens).toBeUndefined();
    expect((out as any).top_p).toBeUndefined();
    expect((out as any).stop_sequences).toBeUndefined();
    expect((out as any).stream).toBe(true);
  });
});
