/**
 * ThreadContext — pure static utility class for branch ID parsing and context operations.
 *
 * All methods are stateless, side-effect-free functions that operate on
 * branch ID strings and message arrays.
 */

import type { Message } from '$lib/types/thread.type';

export class ThreadContext {
  /** Prevent instantiation — all methods are static. */
  private constructor() {}

  /**
   * Normalize a branchId to 3-part format.
   *   "2.0"     → "2.0.0"
   *   "2.0.0"   → "2.0.0"   (already 3 parts)
   *   "2.0.0.1" → "2.0.0"   (truncated to 3 parts)
   */
  static normalizeBranchId(branchId: string): string {
    const parts = branchId.split('.');
    if (parts.length === 2) {
      return `${parts[0]}.${parts[1]}.0`;
    }
    if (parts.length > 3) {
      return parts.slice(0, 3).join('.');
    }
    return branchId;
  }

  /**
   * Get the next available variation branchId for a given base.
   *
   * Scans existing messages for variations of the same row and returns the
   * first unused middle index.
   *
   *   base "1.0.0", no existing → "1.1.0"
   *   base "1.0.0", existing "1.1.0" → "1.2.0"
   *
   * @throws Error when 99 variations are exhausted.
   */
  static getNextVariationBranchId(baseBranchId: string, messages: Message[]): string {
    const normalizedBase = ThreadContext.normalizeBranchId(baseBranchId);
    const baseParts = normalizedBase.split('.');
    const baseNum = Number.parseInt(baseParts[0] ?? '0', 10);

    // Find existing variations: baseNum.X.0
    const existingIndices: number[] = [];
    for (const m of messages) {
      const parts = ThreadContext.normalizeBranchId(m.branchId).split('.');
      if (parts.length === 3 && parts[0] === (baseParts[0] ?? '') && parts[2] === '0') {
        const middleNum = Number.parseInt(parts[1] ?? '0', 10);
        if (!Number.isNaN(middleNum) && middleNum > 0) {
          existingIndices.push(middleNum);
        }
      }
    }

    // Find the next available middle index
    let nextIndex = 1;
    while (existingIndices.includes(nextIndex)) {
      nextIndex++;
      if (nextIndex > 99) {
        throw new Error('Maximum branch variations reached (max: 99)');
      }
    }

    // Return format: "baseNum.nextIndex.0" (e.g., "2.1.0", "2.2.0")
    return `${baseNum}.${nextIndex}.0`;
  }

  /**
   * Extract the row number (first segment) from a branchId.
   *   "3.1.2" → 3
   *   "5.0"   → 5
   */
  static parseBranchRow(branchId: string): number {
    const [firstPart] = branchId.split('.');
    return parseInt(firstPart) ?? 0;
  }

  /**
   * Extract the lane number (second segment) from a branchId.
   *   "1.0.0" → 0   (main lane)
   *   "2.3.1" → 3   (branch lane)
   *   "5"     → 0   (no second part)
   */
  static parseBranchLane(branchId: string): number {
    const [, secondPart] = branchId.split('.');
    return secondPart ? (parseInt(secondPart) ?? 0) : 0;
  }

  /**
   * Get the lane key — the first two segments of a branchId.
   *   "2.1.3" → "2.1"
   *   "1.0"   → "1.0"
   *   "5"     → "5"
   */
  static getLaneKey(branchId: string): string {
    const parts = branchId.split('.');
    return parts.slice(0, 2).join('.');
  }
}
