import type { IChatProvider } from '../interfaces/IChatProvider.js';
import { OllamaChatProvider } from '../providers/OllamaChatProvider.js';
import { OpenAIChatProvider } from '../providers/OpenAIChatProvider.js';
import { ClaudeChatProvider } from '../providers/ClaudeChatProvider.js';
import { PerplexityChatProvider } from '../providers/PerplexityChatProvider.js';

/**
 * Provider types supported by the factory
 */
export enum ProviderType {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  CLAUDE = 'claude',
  PERPLEXITY = 'perplexity',
  // Priority 2 (not yet implemented)
  GEMINI = 'gemini',
  XAI = 'xai',
}

/**
 * Configuration for creating a chat provider
 */
export interface ProviderConfig {
  url: string;
  model: string;
  apiKey?: string;
}

/**
 * Factory for creating chat provider instances
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ChatProviderFactory {
  // Private constructor to prevent instantiation
  private constructor() {}

  /**
   * Creates an appropriate chat provider based on the provider type
   */
  public static createProvider(providerType: ProviderType, config: ProviderConfig): IChatProvider {
    switch (providerType) {
      case ProviderType.OLLAMA:
        if (!config.apiKey) {
          throw new Error('API key is required for Ollama provider');
        }
        return new OllamaChatProvider(config.url, config.apiKey, config.model);

      case ProviderType.OPENAI:
        if (!config.apiKey) {
          throw new Error('API key is required for OpenAI provider');
        }
        return new OpenAIChatProvider(config.url, config.apiKey, config.model);

      case ProviderType.CLAUDE:
        if (!config.apiKey) {
          throw new Error('API key is required for Claude provider');
        }
        return new ClaudeChatProvider(config.url, config.apiKey, config.model);

      case ProviderType.PERPLEXITY:
        if (!config.apiKey) {
          throw new Error('API key is required for Perplexity provider');
        }
        return new PerplexityChatProvider(config.url, config.apiKey, config.model);

      default:
        throw new Error(`Unsupported provider type: ${providerType}`);
    }
  }
}
