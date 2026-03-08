/**
 * Context Types
 *
 * Types for tracking thread context status and per-message context metadata.
 * Used by the UpdateContextStatus observer task and ContextStatus UI component.
 */

/**
 * Per-message context metadata for turn tracking and future compression support.
 */
export interface MessageContext {
  turnIndex: number;
  isProtected: boolean;
  hasCodeBlock: boolean;

  // Future compression fields (populated during context compression):
  compressedByPolicy?: string;
  originalTokenSize?: number;
  compressedTokenSize?: number;
  compressionTimestamp?: number;
  sourceMessageIds?: string[];
}

/**
 * Thread context status computed by UpdateContextStatusTask.
 * Stored in observerStore and consumed by the ContextStatus UI component.
 */
export interface ContextStatus {
  threadId: string;
  modelAccessName: string;
  modelTitle: string;
  maximumTokenCount: number;
  currentTokenCount: number;
  /** Compact threshold as a 0–1 ratio (e.g. 0.75) */
  compactThresholdRatio: number;
  /** Derived: maximumTokenCount * compactThresholdRatio */
  compactThresholdTokenCount: number;
  /** Derived: currentTokenCount / maximumTokenCount (0–1) */
  percentUsed: number;
  lastCompactTimestamp?: number;
  updatedAt: number;
}
