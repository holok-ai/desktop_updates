import { describe, it, expect } from 'vitest';
import { getModelMaxTokens } from '$lib/services/model-token-limits';

describe('getModelMaxTokens', () => {
  describe('exact model name matches', () => {
    it.each([
      ['claude-3.5-sonnet', 200_000],
      ['claude-3-opus', 200_000],
      ['o1-mini-2024', 128_000],
      ['o1-preview', 200_000],
      ['o3-mini', 200_000],
      ['gpt-4o-2024-05-13', 128_000],
      ['gpt-4-turbo-preview', 128_000],
      ['gpt-4-0613', 128_000],
      ['gpt-3.5-turbo', 16_385],
      ['gemini-2.0-flash', 1_048_576],
      ['gemini-1.5-pro-latest', 2_097_152],
      ['gemini-1.5-flash-8b', 1_048_576],
      ['gemini-1.0-pro', 32_760],
      ['llama-3.1-70b', 131_072],
      ['mistral-large', 32_768],
      ['mixtral-8x7b', 32_768],
      ['codellama-34b', 131_072], // 'llama' matches first (first-match-wins)
      ['phi-3-mini', 131_072],
      ['deepseek-coder-v2', 65_536],
      ['qwen-2.5-72b', 131_072],
    ])('returns %i for model "%s"', (model, expected) => {
      expect(getModelMaxTokens(model)).toBe(expected);
    });
  });

  describe('case insensitivity', () => {
    it('matches regardless of case', () => {
      expect(getModelMaxTokens('Claude-3.5-Sonnet')).toBe(200_000);
      expect(getModelMaxTokens('GPT-4O')).toBe(128_000);
      expect(getModelMaxTokens('GEMINI-2.0-FLASH')).toBe(1_048_576);
    });
  });

  describe('first-match-wins ordering', () => {
    it('matches "o1-mini" before "o1"', () => {
      expect(getModelMaxTokens('o1-mini-2024')).toBe(128_000);
    });

    it('matches "gpt-4-turbo" before "gpt-4"', () => {
      expect(getModelMaxTokens('gpt-4-turbo-preview')).toBe(128_000);
    });

    it('matches "gemini-1.5-pro" before "gemini-1.5"', () => {
      expect(getModelMaxTokens('gemini-1.5-pro-latest')).toBe(2_097_152);
    });

    it('matches "llama" before "codellama" since llama appears first in lookup table', () => {
      // codellama contains 'llama', and llama entry comes first — first-match-wins
      expect(getModelMaxTokens('codellama-34b')).toBe(131_072);
    });
  });

  describe('provider fallbacks', () => {
    it('falls back to anthropic default for unknown anthropic model', () => {
      expect(getModelMaxTokens('unknown-model-xyz', 'anthropic')).toBe(200_000);
    });

    it('falls back to openai default for unknown openai model', () => {
      expect(getModelMaxTokens('unknown-model-xyz', 'openai')).toBe(128_000);
    });

    it('falls back to google default for unknown google model', () => {
      expect(getModelMaxTokens('unknown-model-xyz', 'google')).toBe(1_048_576);
    });

    it('falls back to ollama default for unknown ollama model', () => {
      expect(getModelMaxTokens('unknown-model-xyz', 'ollama')).toBe(32_768);
    });

    it('provider matching is case-insensitive', () => {
      expect(getModelMaxTokens('unknown-model', 'Anthropic')).toBe(200_000);
      expect(getModelMaxTokens('unknown-model', 'OPENAI')).toBe(128_000);
    });
  });

  describe('default fallback', () => {
    it('returns 128_000 for unknown model and unknown provider', () => {
      expect(getModelMaxTokens('totally-unknown-model', 'totally-unknown-provider')).toBe(128_000);
    });

    it('returns 128_000 for unknown model with no provider', () => {
      expect(getModelMaxTokens('totally-unknown-model')).toBe(128_000);
    });

    it('returns 128_000 for unknown model with empty provider', () => {
      expect(getModelMaxTokens('totally-unknown-model', '')).toBe(128_000);
    });
  });
});
