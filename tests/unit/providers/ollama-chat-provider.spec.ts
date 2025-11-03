import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('OllamaChatProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('streams tokens for chat() and forwards model from request', async () => {
    const calls: any[] = [];

    class MockOllama {
      constructor(_opts: any) {}
      async *_stream() {
        yield { message: { content: 's1' } };
        yield { message: { content: 's2' } };
      }
      chat(opts: any) {
        calls.push(opts);
        return this._stream();
      }
    }

    vi.doMock('ollama', () => ({ Ollama: MockOllama }));
    const { OllamaChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OllamaChatProvider'
    );

    const prov = new OllamaChatProvider('http://x', 'k', 'mymodel');
    const tokens: string[] = [];
    await prov.chat({ model: 'the-model', messages: [{ role: 'user', content: 'hi' }] }, (t) =>
      tokens.push(t),
    );

    expect(tokens).toEqual(['s1', 's2']);
    expect(calls[0].model).toBe('the-model');
    expect(calls[0].stream).toBe(true);
  });

  it('non-streaming chat() passes non-streaming response to callback', async () => {
    const calls: any[] = [];

    class MockOllama {
      constructor(_opts: any) {}
      chat(opts: any) {
        calls.push(opts);
        return { message: { content: 'final' } };
      }
    }

    vi.doMock('ollama', () => ({ Ollama: MockOllama }));
    const { OllamaChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OllamaChatProvider'
    );

    const prov = new OllamaChatProvider('', 'k', 'default-model');
    const received: string[] = [];
    await prov.chat({ messages: [], streaming: false, model: 'mm' }, (t) => received.push(t));

    expect(received).toEqual(['final']);
    expect(calls[0].stream).toBe(false);
    expect(calls[0].model).toBe('mm');
  });

  it('chatWithOptions streams and forwards options', async () => {
    const calls: any[] = [];

    class MockOllama {
      constructor(_opts: any) {}
      async *_stream() {
        yield { message: { content: 'chunk' } };
      }
      chat(opts: any) {
        calls.push(opts);
        return this._stream();
      }
    }

    vi.doMock('ollama', () => ({ Ollama: MockOllama }));
    const { OllamaChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OllamaChatProvider'
    );
    const prov = new OllamaChatProvider('u', 'k', 'def');

    const tokens: string[] = [];
    await prov.chatWithOptions(
      { model: 'm3', messages: [], options: { temperature: 0.3 }, streaming: true },
      (t) => tokens.push(t),
    );

    expect(tokens).toEqual(['chunk']);
    expect(calls[0].model).toBe('m3');
    // options should be forwarded by converter; ensure stream flag present
    expect(calls[0].stream).toBe(true);
  });

  it('chatWithOptions non-streaming returns final content', async () => {
    const calls: any[] = [];

    class MockOllama {
      constructor(_opts: any) {}
      chat(opts: any) {
        calls.push(opts);
        return { message: { content: 'done' } };
      }
    }

    vi.doMock('ollama', () => ({ Ollama: MockOllama }));
    const { OllamaChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OllamaChatProvider'
    );

    const prov = new OllamaChatProvider('', 'k', 'def');
    const received: string[] = [];
    await prov.chatWithOptions({ model: 'm4', messages: [], options: {}, streaming: false }, (t) =>
      received.push(t),
    );

    expect(received).toEqual(['done']);
    expect(calls[0].stream).toBe(false);
    expect(calls[0].model).toBe('m4');
  });
});
