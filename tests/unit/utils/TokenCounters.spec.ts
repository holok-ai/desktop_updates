import { describe, it, expect, beforeEach, vi } from 'vitest';

import { getTokenCounter } from '../../../src-electron/services/chat/audit/TokenCounters';

describe('TokenCounters', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calculates OpenAI token estimates (words / 0.75)', () => {
    const tc = getTokenCounter('openai');
    const text = 'one two three'; // 3 words -> 3 / 0.75 = 4
    expect(tc.estimateResponseTokens(text)).toBe(4);
    // prompt tokens use JSON.stringify(messages) internally
    const messages = [{ role: 'user', content: 'one two three' }];
    expect(tc.countPromptTokens(messages)).toBe(
      tc.estimateResponseTokens(JSON.stringify(messages)),
    );
  });

  it('calculates Claude token estimates (chars / 4)', () => {
    const tc = getTokenCounter('claude');
    const text = 'abcd'; // length 4 -> 4/4 = 1
    expect(tc.estimateResponseTokens(text)).toBe(1);
    const messages = ['a'];
    expect(tc.countPromptTokens(messages)).toBe(
      tc.estimateResponseTokens(JSON.stringify(messages)),
    );
  });

  it('calculates Ollama token estimates (words / 0.7)', () => {
    const tc = getTokenCounter('ollama');
    const text = 'one two three'; // 3 / 0.7 ~= 4.285 -> 5
    expect(tc.estimateResponseTokens(text)).toBe(5);
    const messages = [{ m: 'one two three' }];
    expect(tc.countPromptTokens(messages)).toBe(
      tc.estimateResponseTokens(JSON.stringify(messages)),
    );
  });

  it('falls back to DefaultTokenCounter for unknown providers', () => {
    const tc = getTokenCounter('something-else');
    const text = 'abcdabcd'; // length 8 -> /4 = 2
    expect(tc.estimateResponseTokens(text)).toBe(2);
    const messages = [{ x: 'y' }];
    expect(tc.countPromptTokens(messages)).toBe(
      tc.estimateResponseTokens(JSON.stringify(messages)),
    );
  });

  it('is case-insensitive for provider name', () => {
    const a = getTokenCounter('OpenAI');
    const b = getTokenCounter('OPENAI');
    expect(a.estimateResponseTokens('one two')).toBe(b.estimateResponseTokens('one two'));
  });
});
