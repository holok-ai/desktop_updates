/**
 * Shared content-aware assertion utilities for fixture-driven tests.
 *
 * These helpers derive expectations from fixture data at runtime,
 * so tests remain valid when fixtures are regenerated.
 */
import { expect } from 'vitest';
import type { Message } from './thread-messages-test-helpers';

// ── BranchId & Deduplication ───────────────────────────────────────

const BRANCH_ID_RE = /^\d+\.\d+\.\d+$/;

/** Every message must have a 3-part branchId (X.Y.Z). */
export function assertValidBranchIds(messages: Message[], label: string): void {
  for (const msg of messages) {
    expect(msg.branchId, `${label}: invalid branchId "${msg.branchId}"`).toMatch(BRANCH_ID_RE);
  }
}

/** No two messages may share the same id. */
export function assertNoDuplicateIds(messages: Message[], label: string): void {
  const ids = messages.map((m) => m.id);
  const unique = new Set(ids);
  expect(unique.size, `${label}: duplicate message ids found`).toBe(ids.length);
}

// ── Fixture path utilities ─────────────────────────────────────────

export type PromptSize = 'small' | 'medium' | 'large' | 'long-turn';
export type FixtureSubcategory = PromptSize | 'error-handling' | 'tool-calling' | 'unknown';

/** Derive the subcategory from a fixture path (e.g. providers/OPENAI/prompts/small/...). */
export function fixtureCategory(path: string): FixtureSubcategory {
  if (path.includes('/prompts/small/')) return 'small';
  if (path.includes('/prompts/medium/')) return 'medium';
  if (path.includes('/prompts/large/')) return 'large';
  if (path.includes('/prompts/long-turn/')) return 'long-turn';
  if (path.includes('/error-handling/')) return 'error-handling';
  if (path.includes('/tool-calling/')) return 'tool-calling';
  return 'unknown';
}

/** Extract provider name (lowercased) from a providers/ fixture path. */
export function providerFromPath(path: string): string {
  const match = path.match(/providers\/([^/]+)\//);
  return match ? match[1].toLowerCase() : '';
}

// ── Prompt size content bounds ─────────────────────────────────────

export const PROMPT_SIZE_BOUNDS: Record<PromptSize, { min: number; max: number }> = {
  small: { min: 1, max: 500 },
  medium: { min: 1, max: 5000 },
  large: { min: 100, max: Infinity },
  'long-turn': { min: 1, max: Infinity },
};

/** Assert assistant content length falls within the bounds for the given prompt size. */
export function assertPromptSizeBounds(messages: Message[], size: PromptSize, label: string): void {
  const bounds = PROMPT_SIZE_BOUNDS[size];
  if (size === 'long-turn') {
    expect(messages.length, `${label}: long-turn should have ≥2 messages`).toBeGreaterThanOrEqual(
      2,
    );
    return;
  }
  const assistant = messages.find((m) => m.role === 'assistant');
  expect(assistant, `${label}: no assistant message found`).toBeDefined();
  const len = assistant!.content.length;
  expect(len, `${label}: content length ${len} below min ${bounds.min}`).toBeGreaterThanOrEqual(
    bounds.min,
  );
  if (bounds.max !== Infinity) {
    expect(len, `${label}: content length ${len} above max ${bounds.max}`).toBeLessThanOrEqual(
      bounds.max,
    );
  }
}

// ── Content-aware key term assertions ──────────────────────────────

/** Common stop words to exclude from key term extraction. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'it',
  'in',
  'on',
  'at',
  'to',
  'of',
  'for',
  'and',
  'or',
  'but',
  'not',
  'with',
  'this',
  'that',
  'from',
  'by',
  'are',
  'was',
  'were',
  'be',
  'been',
  'has',
  'have',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'can',
  'what',
  'where',
  'when',
  'how',
  'who',
  'which',
  'your',
  'you',
  'my',
  'me',
  'i',
  'we',
  'they',
  'he',
  'she',
  'its',
  'our',
  'if',
  'so',
  'up',
  'out',
  'no',
  'yes',
  'all',
  'some',
  'any',
  'about',
  'just',
  'than',
  'then',
  'also',
  'very',
  'too',
  'here',
  'there',
  'please',
  'tell',
  'show',
  'help',
  'give',
  'make',
  'pass',
  'check',
  'could',
  'hello',
  'hey',
]);

/**
 * Extract key terms from the user prompt in a fixture's DTO array.
 * Returns short (≤10 char), meaningful words from the first user message content.
 * These terms should appear in the assistant's response for content-aware validation.
 */
export function extractUserPromptKeyTerms(
  dtos: Array<{ role: string | null; content: unknown }>,
): string[] {
  const userDto = dtos.find((d) => d.role === 'user');
  if (!userDto || typeof userDto.content !== 'string') return [];

  const words = userDto.content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && w.length <= 10 && !STOP_WORDS.has(w));

  // Deduplicate and return unique terms
  return [...new Set(words)];
}

/**
 * Assert that assistant content contains key terms derived from the user prompt.
 *
 * - Small prompts: assistant content is short, check at least 1 key term present
 * - Medium/large prompts: check that at least 1 key term from the user prompt
 *   appears in the assistant response (case-insensitive)
 */
export function assertContentMatchesPrompt(
  messages: Message[],
  dtos: Array<{ role: string | null; content: unknown }>,
  size: PromptSize,
  label: string,
): void {
  const keyTerms = extractUserPromptKeyTerms(dtos);
  if (keyTerms.length === 0) return; // no terms to check (e.g. non-text prompt)

  const assistant = messages.find((m) => m.role === 'assistant');
  if (!assistant) return; // no assistant message (long-turn handled separately)

  const contentLower = assistant.content.toLowerCase();

  if (size === 'small') {
    // Small prompts: content should be short and contain at least 1 key term
    expect(
      assistant.content.length,
      `${label}: small prompt response should be under 500 chars`,
    ).toBeLessThan(500);
  }

  // For all prompt sizes: at least one key term from the user prompt
  // should appear in the assistant response
  const matchedTerms = keyTerms.filter((term) => contentLower.includes(term));
  expect(
    matchedTerms.length,
    `${label}: assistant response should contain at least 1 key term from user prompt. ` +
      `Key terms: [${keyTerms.join(', ')}], content preview: "${assistant.content.slice(0, 80)}..."`,
  ).toBeGreaterThan(0);
}
