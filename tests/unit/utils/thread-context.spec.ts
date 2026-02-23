/**
 * ThreadContext — unit tests for all static methods.
 *
 * Pure functions: no mocks, no setup, just input → output assertions.
 */

import { describe, it, expect } from 'vitest';
import { ThreadContext } from '$lib/utils/thread-context';
import type { Message } from '$lib/types/thread.type';

// ── Helper ──────────────────────────────────────────────────────────

function msg(
  overrides: Partial<Message> & { id: string; branchId: string; role: Message['role'] },
): Message {
  return {
    threadId: 'thread-1',
    content: `content-${overrides.id}`,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// normalizeBranchId
// ═══════════════════════════════════════════════════════════════════

describe('ThreadContext.normalizeBranchId', () => {
  it('converts 2-part to 3-part format', () => {
    expect(ThreadContext.normalizeBranchId('2.0')).toBe('2.0.0');
  });

  it('preserves 3-part format', () => {
    expect(ThreadContext.normalizeBranchId('3.1.2')).toBe('3.1.2');
  });

  it('truncates >3-part to 3 parts', () => {
    expect(ThreadContext.normalizeBranchId('1.2.3.4')).toBe('1.2.3');
  });

  it('truncates 5-part format', () => {
    expect(ThreadContext.normalizeBranchId('1.2.3.4.5')).toBe('1.2.3');
  });

  it('passes through single-part string unchanged', () => {
    expect(ThreadContext.normalizeBranchId('7')).toBe('7');
  });

  it('handles zero values', () => {
    expect(ThreadContext.normalizeBranchId('0.0')).toBe('0.0.0');
  });
});

// ═══════════════════════════════════════════════════════════════════
// getNextVariationBranchId
// ═══════════════════════════════════════════════════════════════════

describe('ThreadContext.getNextVariationBranchId', () => {
  it('returns first variation when no existing variations', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
    ];
    expect(ThreadContext.getNextVariationBranchId('1.0.0', messages)).toBe('1.1.0');
  });

  it('returns next variation when one exists', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'u2', branchId: '1.1.0', role: 'user' }),
    ];
    expect(ThreadContext.getNextVariationBranchId('1.0.0', messages)).toBe('1.2.0');
  });

  it('fills gaps in variation indices', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'u2', branchId: '1.2.0', role: 'user' }), // gap at 1
    ];
    expect(ThreadContext.getNextVariationBranchId('1.0.0', messages)).toBe('1.1.0');
  });

  it('works with 2-part base branchId (normalizes first)', () => {
    const messages = [
      msg({ id: 'u1', branchId: '2.0', role: 'user' }),
    ];
    expect(ThreadContext.getNextVariationBranchId('2.0', messages)).toBe('2.1.0');
  });

  it('works across different row numbers', () => {
    const messages = [
      msg({ id: 'u1', branchId: '3.0.0', role: 'user' }),
      msg({ id: 'u2', branchId: '3.1.0', role: 'user' }),
    ];
    expect(ThreadContext.getNextVariationBranchId('3.0.0', messages)).toBe('3.2.0');
  });

  it('does not count variations from different rows', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'u2', branchId: '2.1.0', role: 'user' }), // different row
    ];
    expect(ThreadContext.getNextVariationBranchId('1.0.0', messages)).toBe('1.1.0');
  });

  it('handles no messages', () => {
    expect(ThreadContext.getNextVariationBranchId('1.0.0', [])).toBe('1.1.0');
  });

  it('throws when 99 variations are exhausted', () => {
    const messages: Message[] = [];
    for (let i = 1; i <= 99; i++) {
      messages.push(msg({ id: `v${i}`, branchId: `1.${i}.0`, role: 'user' }));
    }
    expect(() => ThreadContext.getNextVariationBranchId('1.0.0', messages)).toThrow(
      'Maximum branch variations reached',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// parseBranchRow
// ═══════════════════════════════════════════════════════════════════

describe('ThreadContext.parseBranchRow', () => {
  it('extracts row from 3-part branchId', () => {
    expect(ThreadContext.parseBranchRow('3.1.2')).toBe(3);
  });

  it('extracts row from 2-part branchId', () => {
    expect(ThreadContext.parseBranchRow('5.0')).toBe(5);
  });

  it('extracts row from 1-part branchId', () => {
    expect(ThreadContext.parseBranchRow('7')).toBe(7);
  });

  it('returns NaN for non-numeric input', () => {
    expect(ThreadContext.parseBranchRow('abc')).toBeNaN();
  });

  it('handles zero', () => {
    expect(ThreadContext.parseBranchRow('0.0.0')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// parseBranchLane
// ═══════════════════════════════════════════════════════════════════

describe('ThreadContext.parseBranchLane', () => {
  it('returns 0 for main lane', () => {
    expect(ThreadContext.parseBranchLane('1.0.0')).toBe(0);
  });

  it('returns lane number for branch', () => {
    expect(ThreadContext.parseBranchLane('2.3.1')).toBe(3);
  });

  it('returns 0 when no second part', () => {
    expect(ThreadContext.parseBranchLane('5')).toBe(0);
  });

  it('handles 2-part branchId', () => {
    expect(ThreadContext.parseBranchLane('1.2')).toBe(2);
  });

  it('handles zero lane explicitly', () => {
    expect(ThreadContext.parseBranchLane('4.0')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// getLaneKey
// ═══════════════════════════════════════════════════════════════════

describe('ThreadContext.getLaneKey', () => {
  it('returns first two parts for 3-part branchId', () => {
    expect(ThreadContext.getLaneKey('2.1.3')).toBe('2.1');
  });

  it('returns full string for 2-part branchId', () => {
    expect(ThreadContext.getLaneKey('1.0')).toBe('1.0');
  });

  it('returns just the part for 1-part branchId', () => {
    expect(ThreadContext.getLaneKey('5')).toBe('5');
  });

  it('handles large numbers', () => {
    expect(ThreadContext.getLaneKey('99.42.7')).toBe('99.42');
  });
});
