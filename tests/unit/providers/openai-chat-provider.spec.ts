import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('OpenAIChatProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('streams tokens for chat() using provided model', async () => {
    const calls: any[] = [];

    class MockOpenAI {
      chat: any;
      constructor(_opts: any) {
        this.chat = {
          completions: {
            create: async (_opts: any) => {
              calls.push(_opts);
              return (async function* () {
                yield { choices: [{ delta: { content: 'a' } }] };
                yield { choices: [{ delta: { content: '' } }] };
                yield { choices: [{ delta: { content: 'b' } }] };
              })();
            },
          },
        };
      }
    }

    vi.doMock('openai', () => ({ default: MockOpenAI }));

    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );

    const prov = new OpenAIChatProvider('http://x', 'k', 'mymodel');
    const tokens: string[] = [];
    await prov.chat({ model: 'the-model', messages: [{ role: 'user', content: 'hi' }] }, (t) =>
      tokens.push(t),
    );

    expect(tokens).toEqual(['a', 'b']);
    expect(calls[0].model).toBe('the-model');
  });

  it('uses default model when request.model missing and non-streaming returns final content', async () => {
    const calls: any[] = [];
    class MockOpenAI {
      chat: any;
      constructor(_opts: any) {
        this.chat = {
          completions: {
            create: async (opts: any) => {
              calls.push(opts);
              return { choices: [{ message: { content: 'final' } }] };
            },
          },
        };
      }
    }

    vi.doMock('openai', () => ({ default: MockOpenAI }));
    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );

    // construct provider with empty defaultModel to trigger internal fallback
    const prov = new OpenAIChatProvider('http://x', 'k', '');
    const received: string[] = [];
    await prov.chat({ model: '', messages: [], streaming: false }, (t) => received.push(t));

    expect(received).toEqual(['final']);
    // model passed to API should be fallback default
    expect(calls[0].model).toBe('gpt-3.5-turbo');
  });

  it('chatWithOptions passes optional parameters and streams tokens', async () => {
    const calls: any[] = [];
    class MockOpenAI {
      chat: any;
      constructor(_opts: any) {
        this.chat = {
          completions: {
            create: async (opts: any) => {
              calls.push(opts);
              return (async function* () {
                yield { choices: [{ delta: { content: 'x' } }] };
              })();
            },
          },
        };
      }
    }

    vi.doMock('openai', () => ({ default: MockOpenAI }));
    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );

    const prov = new OpenAIChatProvider('http://x', 'k', 'model1');
    const tokens: string[] = [];
    await prov.chatWithOptions(
      { model: 'm1', messages: [], options: { temperature: 0.5, maxTokens: 10 }, streaming: true },
      (t) => tokens.push(t),
    );

    expect(tokens).toEqual(['x']);
    expect(calls[0].temperature).toBe(0.5);
    expect(calls[0].max_tokens).toBe(10);
    expect(calls[0].stream).toBe(true);
  });

  it('chatWithOptions non-streaming returns final content if present', async () => {
    const calls: any[] = [];
    class MockOpenAI {
      chat: any;
      constructor(_opts: any) {
        this.chat = {
          completions: {
            create: async (opts: any) => {
              calls.push(opts);
              return { choices: [{ message: { content: 'done' } }] };
            },
          },
        };
      }
    }

    vi.doMock('openai', () => ({ default: MockOpenAI }));
    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );

    const prov = new OpenAIChatProvider('http://x', 'k', 'model1');
    const received: string[] = [];
    await prov.chatWithOptions({ model: 'm2', messages: [], options: {}, streaming: false }, (t) =>
      received.push(t),
    );

    expect(received).toEqual(['done']);
    expect(calls[0].model).toBe('m2');
  });
});
