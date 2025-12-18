import { describe, it, expect } from 'vitest';
import { ModelCapabilityService } from '../../../../src-electron/services/chat/ModelCapabilityService.js';

describe('ModelCapabilityService', () => {
  describe('OpenAI Models', () => {
    it('should support GPT-4 models', () => {
      const models = ['gpt-4', 'gpt-4-turbo', 'gpt-4-32k', 'GPT-4-0613'];

      models.forEach((model) => {
        const result = ModelCapabilityService.checkToolSupport(model, 'openai');
        expect(result.supported).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });

    it('should support GPT-5 models (except mini)', () => {
      const supportedModels = ['gpt-5', 'gpt-5.1', 'gpt-5-pro', 'gpt-5.1-codex'];

      supportedModels.forEach((model) => {
        const result = ModelCapabilityService.checkToolSupport(model, 'openai');
        expect(result.supported).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });

    it('should NOT support GPT-5 mini models', () => {
      const result = ModelCapabilityService.checkToolSupport('gpt-5-mini', 'openai');
      expect(result.supported).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('small model');
    });

    it('should support GPT-3.5-turbo', () => {
      const models = ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k'];

      models.forEach((model) => {
        const result = ModelCapabilityService.checkToolSupport(model, 'openai');
        expect(result.supported).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });

    it('should NOT support base GPT-3 models', () => {
      const result = ModelCapabilityService.checkToolSupport('gpt-3', 'openai');
      expect(result.supported).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('legacy model');
    });

    it('should NOT support DALL-E models', () => {
      const result = ModelCapabilityService.checkToolSupport('dall-e-3', 'openai');
      expect(result.supported).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('image generation');
    });

    it('should NOT support embedding models', () => {
      const result = ModelCapabilityService.checkToolSupport('text-embedding-ada-002', 'openai');
      expect(result.supported).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('embedding');
    });

    it('should support ChatGPT-4 variants', () => {
      const result = ModelCapabilityService.checkToolSupport('chatgpt-4o-latest', 'openai');
      expect(result.supported).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should support O1 series', () => {
      const models = ['o1-preview', 'o1-mini'];

      models.forEach((model) => {
        const result = ModelCapabilityService.checkToolSupport(model, 'openai');
        expect(result.supported).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });
  });

  describe('Claude/Anthropic Models', () => {
    it('should support all Claude models', () => {
      const models = [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-3.5-sonnet-20240620',
        'claude-opus-4',
        'claude-haiku-4.5',
      ];

      models.forEach((model) => {
        const result = ModelCapabilityService.checkToolSupport(model, 'anthropic');
        expect(result.supported).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });
  });

  describe('Ollama Models', () => {
    it('should support large Llama models', () => {
      const models = ['llama3:70b', 'llama3.1:70b', 'llama3.1:405b'];

      models.forEach((model) => {
        const result = ModelCapabilityService.checkToolSupport(model, 'ollama');
        expect(result.supported).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });

    it('should NOT support small Llama models', () => {
      const models = ['llama3.2:1b', 'llama3.2:3b', 'llama3:7b', 'llama2:7b'];

      models.forEach((model) => {
        const result = ModelCapabilityService.checkToolSupport(model, 'ollama');
        expect(result.supported).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('small model');
      });
    });

    it('should support Mixtral 8x7B', () => {
      const result = ModelCapabilityService.checkToolSupport('mixtral:8x7b', 'ollama');
      expect(result.supported).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should support Qwen 2.5 72B', () => {
      const result = ModelCapabilityService.checkToolSupport('qwen2.5:72b', 'ollama');
      expect(result.supported).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should NOT support small Qwen models', () => {
      const models = ['qwen:0.5b', 'qwen:1.8b', 'qwen2:0.5b', 'qwen2:1.5b'];

      models.forEach((model) => {
        const result = ModelCapabilityService.checkToolSupport(model, 'ollama');
        expect(result.supported).toBe(false);
        expect(result.reason).toBeDefined();
      });
    });

    it('should NOT support Gemma models', () => {
      const models = ['gemma:2b', 'gemma2:2b', 'gemma3:2b'];

      models.forEach((model) => {
        const result = ModelCapabilityService.checkToolSupport(model, 'ollama');
        expect(result.supported).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('small model');
      });
    });

    it('should NOT support Phi models', () => {
      const result = ModelCapabilityService.checkToolSupport('phi3:3.8b', 'ollama');
      expect(result.supported).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should NOT support TinyLlama', () => {
      const result = ModelCapabilityService.checkToolSupport('tinyllama', 'ollama');
      expect(result.supported).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should support DeepSeek Coder V2', () => {
      const result = ModelCapabilityService.checkToolSupport('deepseek-coder-v2:latest', 'ollama');
      expect(result.supported).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('Perplexity Models', () => {
    it('should support pplx models', () => {
      const models = ['pplx-7b-online', 'pplx-70b-online'];

      models.forEach((model) => {
        const result = ModelCapabilityService.checkToolSupport(model, 'perplexity');
        expect(result.supported).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });

    it('should support Llama 3 on Perplexity', () => {
      const result = ModelCapabilityService.checkToolSupport('llama-3-70b-instruct', 'perplexity');
      expect(result.supported).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should support Mixtral on Perplexity', () => {
      const result = ModelCapabilityService.checkToolSupport('mixtral-8x7b-instruct', 'perplexity');
      expect(result.supported).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should NOT support Sonar models', () => {
      const result = ModelCapabilityService.checkToolSupport('sonar-medium-online', 'perplexity');
      expect(result.supported).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('search');
    });
  });

  describe('Special Cases', () => {
    it('should NOT support Stable Diffusion', () => {
      const result = ModelCapabilityService.checkToolSupport('stable-diffusion-xl', 'other');
      expect(result.supported).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('image generation');
    });

    it('should NOT support Whisper', () => {
      const result = ModelCapabilityService.checkToolSupport('whisper-1', 'openai');
      expect(result.supported).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should NOT support code models that are small', () => {
      const models = ['codellama:7b', 'starcoder:7b', 'wizardcoder:7b'];

      models.forEach((model) => {
        const result = ModelCapabilityService.checkToolSupport(model, 'ollama');
        expect(result.supported).toBe(false);
        expect(result.reason).toBeDefined();
      });
    });

    it('should handle case-insensitive model names', () => {
      const result1 = ModelCapabilityService.checkToolSupport('GPT-4', 'OPENAI');
      const result2 = ModelCapabilityService.checkToolSupport('gpt-4', 'openai');

      expect(result1.supported).toBe(true);
      expect(result2.supported).toBe(true);
    });

    it('should handle model names with whitespace', () => {
      const result = ModelCapabilityService.checkToolSupport('  gpt-4  ', '  openai  ');
      expect(result.supported).toBe(true);
    });

    it('should return friendly error for unknown models', () => {
      const result = ModelCapabilityService.checkToolSupport(
        'unknown-model-xyz',
        'unknown-provider',
      );
      expect(result.supported).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('does not appear to support');
    });

    it('should provide provider-specific suggestions for unknown models', () => {
      const result = ModelCapabilityService.checkToolSupport('unknown-model', 'openai');
      expect(result.supported).toBe(false);
      expect(result.reason).toContain('GPT-4');
    });
  });

  describe('Helper Methods', () => {
    it('should return supported patterns for a provider', () => {
      const patterns = ModelCapabilityService.getSupportedPatterns('openai');
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toBeInstanceOf(RegExp);
    });

    it('should return non-tool patterns', () => {
      const patterns = ModelCapabilityService.getNonToolPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toBeInstanceOf(RegExp);
    });

    it('should return empty array for unknown provider patterns', () => {
      const patterns = ModelCapabilityService.getSupportedPatterns('unknown-provider');
      expect(patterns).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty model name', () => {
      const result = ModelCapabilityService.checkToolSupport('', 'openai');
      expect(result.supported).toBe(false);
    });

    it('should handle empty provider', () => {
      const result = ModelCapabilityService.checkToolSupport('gpt-4', '');
      expect(result.supported).toBe(false);
    });

    it('should prioritize non-tool list over supported list', () => {
      // Even if a pattern matches supported, non-tool list takes priority
      const result = ModelCapabilityService.checkToolSupport('gpt-5-mini', 'openai');
      expect(result.supported).toBe(false);
      expect(result.reason).toContain('small model');
    });
  });

  describe('Real-world Models from Screenshot', () => {
    it('should correctly identify models from user screenshot', () => {
      // Claude models - all should support tools
      expect(ModelCapabilityService.checkToolSupport('Claude Opus 3', 'anthropic').supported).toBe(
        true,
      );
      expect(
        ModelCapabilityService.checkToolSupport('Claude Haiku 3.5', 'anthropic').supported,
      ).toBe(true);
      expect(
        ModelCapabilityService.checkToolSupport('Claude Sonnet 4.5', 'anthropic').supported,
      ).toBe(true);

      // GPT models
      expect(ModelCapabilityService.checkToolSupport('gpt-3.5-turbo', 'openai').supported).toBe(
        true,
      );
      expect(ModelCapabilityService.checkToolSupport('gpt-5.1', 'openai').supported).toBe(true);
      expect(ModelCapabilityService.checkToolSupport('gpt-5-pro', 'openai').supported).toBe(true);
      expect(ModelCapabilityService.checkToolSupport('gpt-5.1-codex', 'openai').supported).toBe(
        true,
      );
      expect(ModelCapabilityService.checkToolSupport('chatgpt-4o-latest', 'openai').supported).toBe(
        true,
      );

      // Mini models - should NOT support
      expect(ModelCapabilityService.checkToolSupport('gpt-5-mini', 'openai').supported).toBe(false);

      // Special models - should NOT support
      expect(ModelCapabilityService.checkToolSupport('dall-e-3', 'openai').supported).toBe(false);
      expect(ModelCapabilityService.checkToolSupport('Sonar', 'perplexity').supported).toBe(false);

      // Small models - should NOT support
      expect(ModelCapabilityService.checkToolSupport('gemma3', 'ollama').supported).toBe(false);
      expect(ModelCapabilityService.checkToolSupport('llama3.2', 'ollama').supported).toBe(false);
      expect(ModelCapabilityService.checkToolSupport('qwen3', 'ollama').supported).toBe(false);
    });
  });
});
