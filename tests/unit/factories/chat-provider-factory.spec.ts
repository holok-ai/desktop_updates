import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ChatProviderFactory', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates Ollama provider when apiKey provided', async () => {
    class MockOllama {
      static calls: any[] = [];
      type = 'ollama';
      url: string;
      apiKey: string;
      model: string;
      constructor(url: string, apiKey: string, model: string) {
        MockOllama.calls.push([url, apiKey, model]);
        this.url = url;
        this.apiKey = apiKey;
        this.model = model;
      }
    }
    vi.doMock('../../../src-electron/services/chat/providers/OllamaChatProvider', () => ({
      OllamaChatProvider: MockOllama,
    }));

    const { ChatProviderFactory, ProviderType } = await import(
      '../../../src-electron/services/chat/factories/ChatProviderFactory'
    );
    const provider: any = ChatProviderFactory.createProvider(ProviderType.OLLAMA, {
      url: 'u',
      model: 'm',
      apiKey: 'k',
    });
    expect(provider.type).toBe('ollama');
    expect(provider.url).toBe('u');
    expect(provider.apiKey).toBe('k');
    expect(provider.model).toBe('m');
    expect(MockOllama.calls[0]).toEqual(['u', 'k', 'm']);
  });

  it('throws when creating OpenAI provider without apiKey', async () => {
    const { ChatProviderFactory, ProviderType } = await import(
      '../../../src-electron/services/chat/factories/ChatProviderFactory'
    );
    expect(() =>
      ChatProviderFactory.createProvider(ProviderType.OPENAI, { url: 'u', model: 'm' } as any),
    ).toThrow(/API key is required for OpenAI provider/);
  });

  it('creates OpenAI provider when apiKey provided', async () => {
    class MockOpenAI {
      static calls: any[] = [];
      type = 'openai';
      url: string;
      apiKey: string;
      model: string;
      constructor(url: string, apiKey: string, model: string) {
        MockOpenAI.calls.push([url, apiKey, model]);
        this.url = url;
        this.apiKey = apiKey;
        this.model = model;
      }
    }
    vi.doMock('../../../src-electron/services/chat/providers/OpenAIChatProvider', () => ({
      OpenAIChatProvider: MockOpenAI,
    }));
    const { ChatProviderFactory, ProviderType } = await import(
      '../../../src-electron/services/chat/factories/ChatProviderFactory'
    );
    const p: any = ChatProviderFactory.createProvider(ProviderType.OPENAI, {
      url: 'u2',
      model: 'm2',
      apiKey: 'k2',
    });
    expect(p.type).toBe('openai');
    expect(MockOpenAI.calls[0]).toEqual(['u2', 'k2', 'm2']);
  });

  it('throws for Perplexity not implemented', async () => {
    const { ChatProviderFactory, ProviderType } = await import(
      '../../../src-electron/services/chat/factories/ChatProviderFactory'
    );
    expect(() =>
      ChatProviderFactory.createProvider(ProviderType.PERPLEXITY, { url: 'x', model: 'm' } as any),
    ).toThrow(/PerplexityChatProvider not implemented yet/);
  });

  it('throws for unsupported provider type', async () => {
    const { ChatProviderFactory } = await import(
      '../../../src-electron/services/chat/factories/ChatProviderFactory'
    );
    // cast a string to the enum to exercise default branch
    expect(() =>
      ChatProviderFactory.createProvider('unknown' as any, { url: 'x', model: 'm' } as any),
    ).toThrow(/Unsupported provider type/);
  });
});
