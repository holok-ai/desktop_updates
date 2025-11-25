import { OpenAIChatProvider } from './OpenAIChatProvider.js';

/**
 * Perplexity provider that reuses the OpenAI implementation while pointing at
 * Perplexity's OpenAI-compatible endpoint.
 */
export class PerplexityChatProvider extends OpenAIChatProvider {
  private static readonly DEFAULT_ENDPOINT = 'https://api.perplexity.ai';
  private static readonly SUPPORTED_MODELS = new Set(['pplx-70b-online', 'pplx-7b-chat']);
  private static readonly DEFAULT_MODEL = 'pplx-70b-online';

  constructor(apiEndpoint: string, apiKey: string, defaultModel: string) {
    super(
      PerplexityChatProvider.resolveEndpoint(apiEndpoint),
      apiKey,
      PerplexityChatProvider.resolveModel(defaultModel),
    );
  }

  /**
   * Perplexity exposes OpenAI-compatible function calling, so tools are always supported.
   */
  public override supportsTools(): boolean {
    return true;
  }

  private static resolveEndpoint(endpoint?: string): string {
    if (!endpoint) {
      return PerplexityChatProvider.DEFAULT_ENDPOINT;
    }
    return endpoint.replace(/\/$/, '');
  }

  private static resolveModel(model?: string): string {
    if (model && PerplexityChatProvider.SUPPORTED_MODELS.has(model)) {
      return model;
    }
    if (model) {
      return model;
    }
    return PerplexityChatProvider.DEFAULT_MODEL;
  }
}
