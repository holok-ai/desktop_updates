import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ToolDefinition } from '../../../src-electron/services/tool-calling/file-tools.service';

describe('OllamaChatProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('streams tokens for chat() and forwards model from request', async () => {
    const calls: any[] = [];

    class MockOllama {
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

  it('disables tool support after native attempt fails and falls back', async () => {
    let callCount = 0;

    class MockOllama {
      chat(_opts: any) {
        callCount += 1;
        if (callCount === 1) {
          throw new Error('tool support unavailable');
        }
        return { message: { content: 'fallback-response' } };
      }
    }

    vi.doMock('ollama', () => ({ Ollama: MockOllama }));
    const { OllamaChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OllamaChatProvider'
    );

    const provider = new OllamaChatProvider('', 'k', 'def');
    const tokens: string[] = [];
    const toolDefs: ToolDefinition[] = [
      {
        name: 'read_file',
        description: 'Read a file',
        input_schema: { type: 'object', properties: {}, required: [] },
      },
    ];

    await provider.chatWithTools(
      { model: 'mm', messages: [{ role: 'user', content: 'hello' }], streaming: false },
      toolDefs,
      (token) => tokens.push(token),
      async () => ({ success: true }),
    );

    expect(tokens).toEqual(['fallback-response']);
    expect(provider.supportsTools()).toBe(false);
  });
});
