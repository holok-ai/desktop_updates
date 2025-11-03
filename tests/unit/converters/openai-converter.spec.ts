import { describe, it, expect, beforeEach, vi } from 'vitest';

import { OpenAIConverter } from '../../../src-electron/services/chat/converters/OpenAIConverter';

describe('OpenAIConverter', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('maps assistant, system and user/unknown roles correctly', () => {
    const req = {
      model: 'm',
      messages: [
        { role: 'assistant', content: 'a' },
        { role: 'system', content: 'b' },
        { role: 'user', content: 'c' },
        { role: 'custom', content: 'd' },
      ],
    } as any;

    const out = OpenAIConverter.toOpenAIRequest(req);
    expect(out.model).toBe('m');
    expect(out.messages.map((m: any) => m.role)).toEqual(['assistant', 'system', 'user', 'user']);
    expect(out.messages.map((m: any) => m.content)).toEqual(['a', 'b', 'c', 'd']);
    // default stream behaviour
    expect(out.stream).toBe(true);
  });

  it('respects explicit streaming=false', () => {
    const req = { model: 'm', messages: [], streaming: false } as any;
    expect(OpenAIConverter.toOpenAIRequest(req).stream).toBe(false);
  });

  it('includes optional parameters when provided in toOpenAIRequestWithOptions', () => {
    const req = {
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      streaming: true,
      options: {
        temperature: 0.2,
        maxTokens: 42,
        topP: 0.5,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
        stop: ['\n'],
      },
    } as any;

    const out = OpenAIConverter.toOpenAIRequestWithOptions(req);
    expect(out.model).toBe('m');
    expect((out as any).temperature).toBe(0.2);
    expect((out as any).max_tokens).toBe(42);
    expect((out as any).top_p).toBe(0.5);
    expect((out as any).frequency_penalty).toBe(0.1);
    expect((out as any).presence_penalty).toBe(0.2);
    expect((out as any).stop).toEqual(['\n']);
  });

  it('omits optional parameters when undefined', () => {
    const req = { model: 'm', messages: [{ role: 'user', content: 'x' }], options: {} } as any;
    const out = OpenAIConverter.toOpenAIRequestWithOptions(req);
    expect((out as any).temperature).toBeUndefined();
    expect((out as any).max_tokens).toBeUndefined();
    expect((out as any).top_p).toBeUndefined();
    expect((out as any).frequency_penalty).toBeUndefined();
    expect((out as any).presence_penalty).toBeUndefined();
    expect((out as any).stop).toBeUndefined();
  });
});
