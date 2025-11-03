import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ClaudeChatProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('streams tokens from messages.stream and calls finalMessage', async () => {
    const calls: any[] = [];

    class MockStream {
      cb: ((t: string) => void) | null = null;
      on(event: string, fn: (t: string) => void) {
        if (event === 'text') this.cb = fn;
        return this;
      }
      async finalMessage() {
        // call back synchronously to emulate stream emitting before finalMessage resolves
        this.cb?.('tok1');
        this.cb?.('tok2');
        return { ok: true };
      }
    }

    class MockAnthropic {
      messages: any;
      constructor(_opts: any) {
        this.messages = {
          stream: (opts: any) => {
            calls.push(opts);
            const s = new MockStream();
            return s;
          },
          create: async (opts: any) => {
            calls.push(opts);
            return { content: [{ type: 'text', text: 'final' }] };
          },
        };
      }
    }

    vi.doMock('@anthropic-ai/sdk', () => ({ default: MockAnthropic }));
    const { ClaudeChatProvider } = await import(
      '../../../src-electron/services/chat/providers/ClaudeChatProvider'
    );

    const provider = new ClaudeChatProvider('http://api', 'k', 'cm');
    const tokens: string[] = [];
    await provider.chat({ model: 'mymod', messages: [{ role: 'user', content: 'hi' }] }, (t) =>
      tokens.push(t),
    );

    // tokens should have been received via the stream text events
    expect(tokens).toEqual(['tok1', 'tok2']);
    // verify model passed
    expect(calls[0].model).toBe('mymod');
  });

  it('non-streaming chat collects final content and calls onTokenReceived', async () => {
    const calls: any[] = [];
    class MockAnthropic {
      messages: any;
      constructor(_opts: any) {
        this.messages = {
          stream: (_opts: any) => ({ on: () => ({ finalMessage: async () => ({}) }) }),
          create: async (opts: any) => {
            calls.push(opts);
            return { content: [{ type: 'text', text: 'answer' }] };
          },
        };
      }
    }

    vi.doMock('@anthropic-ai/sdk', () => ({ default: MockAnthropic }));
    const { ClaudeChatProvider } = await import(
      '../../../src-electron/services/chat/providers/ClaudeChatProvider'
    );

    const provider = new ClaudeChatProvider('', 'k', 'def');
    const received: string[] = [];
    await provider.chat({ model: 'm2', messages: [], streaming: false }, (t) => received.push(t));

    expect(received).toEqual(['answer']);
    expect(calls[0].model).toBe('m2');
  });

  it('chatWithOptions passes options into stream/create and streams text', async () => {
    const calls: any[] = [];

    class MockStream {
      cb: ((t: string) => void) | null = null;
      on(event: string, fn: (t: string) => void) {
        if (event === 'text') this.cb = fn;
        return this;
      }
      async finalMessage() {
        // emit a chunk synchronously before resolving
        this.cb?.('chunk');
        return { done: true };
      }
    }

    class MockAnthropic {
      messages: any;
      constructor(_opts: any) {
        this.messages = {
          stream: (opts: any) => {
            calls.push(opts);
            const s = new MockStream();
            return s;
          },
          create: async (opts: any) => {
            calls.push(opts);
            return { content: [{ type: 'text', text: 'done' }] };
          },
        };
      }
    }

    vi.doMock('@anthropic-ai/sdk', () => ({ default: MockAnthropic }));
    const { ClaudeChatProvider } = await import(
      '../../../src-electron/services/chat/providers/ClaudeChatProvider'
    );
    const provider = new ClaudeChatProvider('u', 'k', 'def');

    const tokens: string[] = [];
    await provider.chatWithOptions(
      { model: 'm3', messages: [], options: { temperature: 0.3 }, streaming: true },
      (t) => tokens.push(t),
    );

    expect(tokens).toEqual(['chunk']);
    expect(calls[0].model).toBe('m3');
    expect(calls[0].temperature).toBe(0.3);
  });

  it('chatWithOptions non-streaming returns joined text blocks', async () => {
    const calls: any[] = [];
    class MockAnthropic {
      messages: any;
      constructor(_opts: any) {
        this.messages = {
          stream: (_opts: any) => ({ on: () => ({ finalMessage: async () => ({}) }) }),
          create: async (opts: any) => {
            calls.push(opts);
            return {
              content: [
                { type: 'text', text: 'one' },
                { type: 'text', text: 'two' },
              ],
            };
          },
        };
      }
    }

    vi.doMock('@anthropic-ai/sdk', () => ({ default: MockAnthropic }));
    const { ClaudeChatProvider } = await import(
      '../../../src-electron/services/chat/providers/ClaudeChatProvider'
    );

    const provider = new ClaudeChatProvider('', 'k', 'def');
    const received: string[] = [];
    await provider.chatWithOptions(
      { model: 'm4', messages: [], options: {}, streaming: false },
      (t) => received.push(t),
    );

    expect(received).toEqual(['onetwo']);
    expect(calls[0].model).toBe('m4');
  });
});
