/**
 * Artifact Editing Types
 *
 * Shared types for the document editing / artifact versioning system.
 * Used by both the main (electron) and renderer processes.
 */

export type ArtifactAttributionSource = 'ai' | 'user';

export type VersionSourceAction =
  | 'attachment_edit'
  | 'accept_change'
  | 'reject_change'
  | 'user_edit_autosave'
  | 'user_edit_on_export'
  | 'user_edit_on_prompt';

export type DisplayStyle = 'final' | 'inline-markup' | 'diff-only' | 'side-by-side';

export type UnresolvedChangesBehavior = 'include' | 'remove' | 'ask';

export type AttributionFilter = 'all' | 'ai' | 'user';

/**
 * A single immutable version snapshot of an artifact's content.
 */
export interface ArtifactVersion {
  /** Sequential version ID (1, 2, 3...) */
  id: number;
  /** Canonical Markdown content */
  content: string;
  /** Who created this version */
  attribution: ArtifactAttributionSource;
  /** What action created this version */
  sourceAction: VersionSourceAction;
  /** Human-readable summary of what changed (from AI or auto-generated) */
  changeSummary: string;
  /** Epoch ms when this version was created */
  createdAt: number;
}

/**
 * A tracked document artifact bound to a single thread.
 */
export interface Artifact {
  /** Unique artifact ID */
  id: string;
  /** Thread this artifact belongs to */
  threadId: string;
  /** Original filename */
  filename: string;
  /** Original MIME type of the imported file */
  originalMimeType: string;
  /** Ordered list of version snapshots */
  versions: ArtifactVersion[];
  /** Epoch ms when the artifact was created */
  createdAt: number;
  /** Epoch ms of the last modification */
  updatedAt: number;
}

/**
 * A single diff change hunk for UI rendering.
 */
export interface DiffChange {
  /** The kind of change */
  type: 'addition' | 'deletion' | 'modification';
  /** Lines removed (empty for additions) */
  oldLines: string[];
  /** Lines added (empty for deletions) */
  newLines: string[];
  /** 1-based start line in the base document */
  oldStart: number;
  /** 1-based start line in the target document */
  newStart: number;
  /** Who produced this change */
  attribution: ArtifactAttributionSource;
  /** Which version introduced this change */
  versionId: number;
  /** Transient UI state — not persisted */
  resolved?: 'accepted' | 'rejected';
}

/**
 * Result of diffing two versions.
 */
export interface DiffResult {
  /** Structured change hunks for the UI */
  changes: DiffChange[];
  /** The base (left) version ID */
  baseVersionId: number;
  /** The target (right) version ID */
  targetVersionId: number;
  /** Raw unified diff string */
  unifiedPatch: string;
}

/**
 * Structured response expected from the AI when document mode is active.
 */
export interface AiDiffResponse {
  /** Unified diff in GitHub format */
  diff: string;
  /** Human-readable change summary */
  summary: string;
}

/**
 * Discard event log entry (for auditability).
 */
export interface DiscardEvent {
  /** The version ID that was removed */
  removedVersionId: number;
  /** The version ID that became current after discard */
  resultingVersionId: number;
  /** Epoch ms */
  timestamp: number;
}
