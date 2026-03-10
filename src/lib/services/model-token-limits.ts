/**
 * Model Token Limits
 *
 * Static lookup of maximum context window sizes for known LLM models.
 * Used by UpdateContextStatusTask to determine the upper bound for context tracking.
 *
 * Always returns a value — falls back by provider, then to a conservative default.
 * Future enhancement: query provider SDKs for exact values where supported.
 */

interface ModelEntry {
  /** Lowercase substring to match against model access name */
  match: string;
  maxTokens: number;
}

/** Ordered lookup table — first match wins */
const MODEL_ENTRIES: ModelEntry[] = [
  // ── Anthropic Claude ──
  // All Claude 3.x and newer models share a 200K context window
  { match: 'claude', maxTokens: 200_000 },

  // ── OpenAI ──
  { match: 'o1-mini', maxTokens: 128_000 },
  { match: 'o1', maxTokens: 200_000 },
  { match: 'o3', maxTokens: 200_000 },
  { match: 'gpt-5', maxTokens: 128_000 },
  { match: 'gpt-4o', maxTokens: 128_000 },
  { match: 'gpt-4-turbo', maxTokens: 128_000 },
  { match: 'gpt-4', maxTokens: 128_000 },
  { match: 'gpt-3.5', maxTokens: 16_385 },

  // ── Google Gemini ──
  { match: 'gemini-2.0', maxTokens: 1_048_576 },
  { match: 'gemini-1.5-pro', maxTokens: 2_097_152 },
  { match: 'gemini-1.5-flash', maxTokens: 1_048_576 },
  { match: 'gemini-1.5', maxTokens: 1_048_576 },
  { match: 'gemini-1.0', maxTokens: 32_760 },
  { match: 'gemini', maxTokens: 1_048_576 },

  // ── Local / Ollama models ──
  { match: 'llama', maxTokens: 131_072 },
  { match: 'mistral', maxTokens: 32_768 },
  { match: 'mixtral', maxTokens: 32_768 },
  { match: 'codellama', maxTokens: 16_384 },
  { match: 'phi', maxTokens: 131_072 },
  { match: 'deepseek', maxTokens: 65_536 },
  { match: 'qwen', maxTokens: 131_072 },
];

/** Provider-level fallbacks when no model name matches */
const PROVIDER_DEFAULTS: Record<string, number> = {
  anthropic: 200_000,
  openai: 128_000,
  google: 1_048_576,
  ollama: 32_768,
};

/** Conservative default when no model name or provider matches */
const DEFAULT_MAX_TOKENS = 128_000;

/**
 * Returns the maximum context window size (in tokens) for the given model.
 *
 * Lookup order:
 * 1. Model access name substring match (case-insensitive)
 * 2. Provider fallback
 * 3. Generic default (128K)
 */
export function getModelMaxTokens(accessName: string, provider?: string): number {
  const lower = accessName.toLowerCase();

  for (const entry of MODEL_ENTRIES) {
    if (lower.includes(entry.match)) {
      return entry.maxTokens;
    }
  }

  if (provider !== undefined && provider !== '') {
    const providerLower = provider.toLowerCase();
    for (const [key, value] of Object.entries(PROVIDER_DEFAULTS)) {
      if (providerLower.includes(key)) {
        return value;
      }
    }
  }

  return DEFAULT_MAX_TOKENS;
}
