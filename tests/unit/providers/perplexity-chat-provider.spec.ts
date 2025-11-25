import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('PerplexityChatProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('normalizes endpoint and model defaults before calling OpenAI base class', async () => {
    const ctorArgs: Array<{ baseURL: string; apiKey: string; model: string }> = [];

    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class MockOpenAIChatProvider {
      constructor(baseURL: string, apiKey: string, model: string) {
        ctorArgs.push({ baseURL, apiKey, model });
      }
    }

    vi.doMock('../../../src-electron/services/chat/providers/OpenAIChatProvider', () => ({
      OpenAIChatProvider: MockOpenAIChatProvider,
    }));

    const { PerplexityChatProvider } = await import(
      '../../../src-electron/services/chat/providers/PerplexityChatProvider'
    );

    const provider = new PerplexityChatProvider('', 'test-key', '');

    expect(provider).toBeInstanceOf(MockOpenAIChatProvider);
    expect(ctorArgs[0]).toEqual({
      baseURL: 'https://api.perplexity.ai',
      apiKey: 'test-key',
      model: 'pplx-70b-online',
    });
  });

  it('passes through custom endpoint/model while still supporting tools', async () => {
    const ctorArgs: Array<{ baseURL: string; apiKey: string; model: string }> = [];

    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class MockOpenAIChatProvider {
      constructor(baseURL: string, apiKey: string, model: string) {
        ctorArgs.push({ baseURL, apiKey, model });
      }
    }

    vi.doMock('../../../src-electron/services/chat/providers/OpenAIChatProvider', () => ({
      OpenAIChatProvider: MockOpenAIChatProvider,
    }));

    const { PerplexityChatProvider } = await import(
      '../../../src-electron/services/chat/providers/PerplexityChatProvider'
    );

    const provider = new PerplexityChatProvider('https://custom.api/', 'key', 'pplx-7b-chat');

    expect(ctorArgs[0]).toEqual({
      baseURL: 'https://custom.api',
      apiKey: 'key',
      model: 'pplx-7b-chat',
    });
    expect(provider.supportsTools()).toBe(true);
  });
});

