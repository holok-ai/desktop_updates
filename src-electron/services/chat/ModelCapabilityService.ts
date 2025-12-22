/* eslint-disable @typescript-eslint/no-extraneous-class */
/**
 * ModelCapabilityService
 *
 * Centralized service for determining model capabilities, specifically tool/function calling support.
 * This service provides:
 * 1. Tool support detection based on model name and provider
 * 2. Friendly error messages for unsupported models
 * 3. Pattern-based matching for flexibility with new models
 */

export interface ModelCapabilityResult {
  supported: boolean;
  reason?: string;
}

export class ModelCapabilityService {
  /**
   * Models that support native tool/function calling
   * Organized by provider with pattern-based matching
   */
  private static readonly TOOL_SUPPORTED_MODELS = {
    // OpenAI/GPT models
    openai: [
      /^gpt-4/i, // GPT-4, GPT-4-turbo, GPT-4-32k, etc.
      /^gpt-5/i, // GPT-5 and variants (except mini)
      /^gpt-3\.5-turbo/i, // GPT-3.5-turbo (but not base gpt-3)
      /^chatgpt-4/i, // ChatGPT-4 variants
      /^o1/i, // O1 series (o1-preview, o1-mini)
    ],

    // Claude/Anthropic models (all support tools)
    anthropic: [
      /^claude/i, // All Claude models (Opus, Sonnet, Haiku)
    ],

    // Perplexity models (most support tools, except specialized)
    perplexity: [
      /^pplx/i, // pplx-7b-online, pplx-70b-online
      /^llama-3/i, // Llama 3 variants on Perplexity
      /^mixtral/i, // Mixtral on Perplexity
    ],

    // Ollama models (limited support - larger models only)
    ollama: [
      /^llama3:70b/i, // Llama 3 70B
      /^llama3\.1:70b/i, // Llama 3.1 70B
      /^llama3\.1:405b/i, // Llama 3.1 405B
      /^mixtral:8x7b/i, // Mixtral 8x7B
      /^qwen2\.5:72b/i, // Qwen 2.5 72B
      /^deepseek-coder-v2/i, // DeepSeek Coder V2
    ],
  };

  /**
   * Models that explicitly DO NOT support tool calling
   * These override any pattern matches above
   */
  private static readonly NON_TOOL_MODELS = [
    // Small models (< 7B parameters)
    /^llama3\.2:1b/i,
    /^llama3\.2:3b/i,
    /^llama3:7b/i,
    /^llama2/i,
    /^gemma:2b/i,
    /^gemma2:2b/i,
    /^gemma3:2b/i,
    /^phi/i,
    /^qwen:0\.5b/i,
    /^qwen:1\.8b/i,
    /^qwen2:0\.5b/i,
    /^qwen2:1\.5b/i,
    /^tinyllama/i,
    /^orca-mini/i,
    /^vicuna:7b/i,

    // Specialized non-chat models
    /^dall-e/i, // Image generation
    /^stable-diffusion/i, // Image generation
    /^whisper/i, // Speech-to-text
    /^text-embedding/i, // Embedding models
    /^text-davinci/i, // Legacy completion models
    /^gpt-3(?!\.5-turbo)/i, // GPT-3 base models (but not 3.5-turbo)
    /^gpt-.*-mini/i, // Mini variants (gpt-5-mini, etc.)

    // Code-specific models that may lack tool support
    /^codellama:7b/i,
    /^starcoder:7b/i,
    /^wizardcoder:7b/i,

    // Search/specialized models
    /^sonar/i, // Perplexity Sonar (search-focused)
  ];

  /**
   * Check if a model supports native tool/function calling
   * @param modelName The name/ID of the model (e.g., "gpt-4", "claude-3-opus-20240229")
   * @param providerType The provider type (e.g., "openai", "anthropic", "ollama", "perplexity")
   * @returns ModelCapabilityResult with support status and optional reason
   */
  public static checkToolSupport(modelName: string, providerType: string): ModelCapabilityResult {
    const normalizedModel = modelName.toLowerCase().trim();
    const normalizedProvider = providerType.toLowerCase().trim();

    // First, check if model is explicitly in the non-tool list (highest priority)
    for (const pattern of this.NON_TOOL_MODELS) {
      if (pattern.test(normalizedModel)) {
        return {
          supported: false,
          reason: this.getNonSupportReason(normalizedModel),
        };
      }
    }

    // Then check if provider has tool-supported models
    const providerPatterns =
      this.TOOL_SUPPORTED_MODELS[normalizedProvider as keyof typeof this.TOOL_SUPPORTED_MODELS];

    if (providerPatterns) {
      for (const pattern of providerPatterns) {
        if (pattern.test(normalizedModel)) {
          return { supported: true };
        }
      }
    }

    // Default: assume no tool support for unknown models (safe default)
    return {
      supported: false,
      reason: this.getDefaultNonSupportReason(normalizedModel, normalizedProvider),
    };
  }

  /**
   * Get a friendly error message for models that don't support tools
   */
  private static getNonSupportReason(modelName: string): string {
    const model = modelName.toLowerCase();

    // Image generation models
    if (/dall-e|stable-diffusion/.test(model)) {
      return `${modelName} is an image generation model and does not support tool calling. Please use a chat model like GPT-4 or Claude for tasks requiring file operations.`;
    }

    // Embedding models
    if (/embedding/.test(model)) {
      return `${modelName} is an embedding model and does not support tool calling. Please use a chat model like GPT-4 or Claude for tasks requiring file operations.`;
    }

    // Small models (< 7B parameters)
    if (
      /llama3\.2:(1b|3b)|llama3:7b|llama2|gemma:2b|gemma2:2b|gemma3:2b|phi|tinyllama|mini|qwen:0\.5b|qwen:1\.8b|qwen2:0\.5b|qwen2:1\.5b|orca-mini|vicuna:7b/.test(
        model,
      )
    ) {
      return `${modelName} is a small model that does not support native tool calling. These models work best for simple chat without file operations. Please use a larger model like GPT-4, Claude, or Llama 3 70B for tasks requiring file operations.`;
    }

    // Legacy models
    if (/gpt-3(?!\.5-turbo)|text-davinci/.test(model)) {
      return `${modelName} is a legacy model that does not support tool calling. Please use GPT-3.5-turbo or newer models for tasks requiring file operations.`;
    }

    // Search-specialized models
    if (/sonar/.test(model)) {
      return `${modelName} is optimized for web search and does not support file tool calling. Please use a general chat model like GPT-4 or Claude for file operations.`;
    }

    // Generic small model message
    return `${modelName} does not support native tool calling. Please use a larger model like GPT-4, Claude, or Llama 3 70B for tasks requiring file operations.`;
  }

  /**
   * Get default error message for unknown models
   */
  private static getDefaultNonSupportReason(modelName: string, providerType: string): string {
    const supportedExamples = this.getSupportedExamplesForProvider(providerType);

    if (supportedExamples) {
      return `${modelName} does not appear to support native tool calling. For tasks requiring file operations, please use a model known to support tools, such as: ${supportedExamples}`;
    }

    return `${modelName} does not appear to support native tool calling. For tasks requiring file operations, please use a model like GPT-4, Claude Opus/Sonnet, or Llama 3 70B.`;
  }

  /**
   * Get example supported models for a provider
   */
  private static getSupportedExamplesForProvider(providerType: string): string | null {
    switch (providerType.toLowerCase()) {
      case 'openai':
        return 'GPT-4, GPT-5, or GPT-3.5-turbo';
      case 'anthropic':
        return 'Claude Opus, Claude Sonnet, or Claude Haiku';
      case 'ollama':
        return 'Llama 3 70B or Mixtral 8x7B';
      case 'perplexity':
        return 'pplx-70b-online or Mixtral';
      default:
        return null;
    }
  }

  /**
   * Get list of all patterns that support tools (for debugging/testing)
   */
  public static getSupportedPatterns(providerType: string): RegExp[] {
    const provider = providerType.toLowerCase();
    return this.TOOL_SUPPORTED_MODELS[provider as keyof typeof this.TOOL_SUPPORTED_MODELS] || [];
  }

  /**
   * Get list of all non-tool patterns (for debugging/testing)
   */
  public static getNonToolPatterns(): RegExp[] {
    return [...this.NON_TOOL_MODELS];
  }
}
