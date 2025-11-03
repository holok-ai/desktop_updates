import type { TokenCounter } from './AuditTypes.js';
import { ProviderType } from '../factories/ChatProviderFactory.js';

/**
 * Simple token counter implementation for OpenAI models
 */
class OpenAITokenCounter implements TokenCounter {
  // Very rough estimation - in production you'd use a proper tokenizer like tiktoken
  countPromptTokens(messages: unknown[]): number {
    return this.estimateTokens(JSON.stringify(messages));
  }

  estimateResponseTokens(text: string): number {
    return this.estimateTokens(text);
  }

  private estimateTokens(text: string): number {
    // A simple approximation - words / 0.75 (average tokens per word)
    return Math.ceil(text.split(/\s+/).length / 0.75);
  }
}

/**
 * Simple token counter implementation for Claude models
 */
class ClaudeTokenCounter implements TokenCounter {
  countPromptTokens(messages: unknown[]): number {
    return this.estimateTokens(JSON.stringify(messages));
  }

  estimateResponseTokens(text: string): number {
    return this.estimateTokens(text);
  }

  private estimateTokens(text: string): number {
    // A simple approximation - characters / 4 (rough Claude token size)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Simple token counter implementation for Ollama models
 */
class OllamaTokenCounter implements TokenCounter {
  countPromptTokens(messages: unknown[]): number {
    return this.estimateTokens(JSON.stringify(messages));
  }

  estimateResponseTokens(text: string): number {
    return this.estimateTokens(text);
  }

  private estimateTokens(text: string): number {
    // A simple approximation based on average token size
    return Math.ceil(text.split(/\s+/).length / 0.7);
  }
}

/**
 * Default token counter implementation
 */
class DefaultTokenCounter implements TokenCounter {
  countPromptTokens(messages: unknown[]): number {
    return this.estimateTokens(JSON.stringify(messages));
  }

  estimateResponseTokens(text: string): number {
    return this.estimateTokens(text);
  }

  private estimateTokens(text: string): number {
    // Very simple approximation
    return Math.ceil(text.length / 4);
  }
}

/**
 * Get the appropriate token counter for a provider
 */
export function getTokenCounter(provider: string): TokenCounter {
  const providerType = provider.toLowerCase();

  switch (providerType) {
    case ProviderType.OPENAI.toLowerCase():
      return new OpenAITokenCounter();
    case ProviderType.CLAUDE.toLowerCase():
      return new ClaudeTokenCounter();
    case ProviderType.OLLAMA.toLowerCase():
      return new OllamaTokenCounter();
    default:
      return new DefaultTokenCounter();
  }
}
