/**
 * Thread Copy Functionality Types
 * Shared between main process and renderer
 *
 * Supports bidirectional copying of threads between Personal Space (local filesystem)
 * and Project Workspaces (cloud storage) with automatic file migration.
 */

export type UUID = string;
export type GUID = string;

/**
 * Error codes for copy operations
 */
export type CopyErrorCode =
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'FILE_TOO_LARGE'
  | 'CANCELLED'
  | 'UNKNOWN';

/**
 * Copy operation phases
 */
export type CopyPhase = 'validating' | 'migrating' | 'creating' | 'complete' | 'failed';

/**
 * Copy operation status
 */
export type CopyOperationStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Options for copy operations
 */
export interface CopyOptions {
  /** Whether to allow duplicate copies */
  allowDuplicate?: boolean;

  /** Whether to show confirmation for large files */
  confirmLargeFiles?: boolean;

  /** Threshold in bytes for large file warning (default: 100MB) */
  largeFileThreshold?: number;
}

/**
 * Progress information for ongoing copy operations
 */
export interface CopyProgress {
  /** Unique operation identifier */
  operationId: string;

  /** Current phase of the operation */
  phase: CopyPhase;

  /** Total number of files to migrate */
  filesTotal: number;

  /** Number of files completed */
  filesCompleted: number;

  /** Total bytes to transfer */
  bytesTotal: number;

  /** Bytes transferred so far */
  bytesTransferred: number;

  /** Current file being transferred */
  currentFile?: string;

  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;

  /** Error message if operation failed */
  error?: string;
}

/**
 * Error thrown during copy operations
 */
export interface CopyOperationError extends Error {
  /** Error code for categorization */
  code: CopyErrorCode;

  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Local file reference (Personal Space)
 */
export interface LocalFileReference {
  /** Local filesystem path */
  path: string;

  /** Original filename */
  filename: string;

  /** MIME type */
  mimeType: string;

  /** File size in bytes */
  size: number;
}

/**
 * Cloud file reference (Project Workspace)
 */
export interface CloudFileReference {
  /** Cloud storage file ID */
  fileId: string;

  /** Original filename */
  filename: string;

  /** MIME type */
  mimeType: string;

  /** File size in bytes */
  size: number;

  /** Cloud storage URL */
  url: string;
}

/**
 * Progress information for file migration
 */
export interface MigrationProgress {
  /** Current file being transferred */
  currentFile: string;

  /** Index of current file (0-based) */
  fileIndex: number;

  /** Total number of files */
  totalFiles: number;

  /** Bytes transferred for current operation */
  bytesTransferred: number;

  /** Total bytes to transfer */
  totalBytes: number;

  /** Transfer speed in bytes per second */
  speed: number;
}

/**
 * Metadata about a thread copy operation
 */
export interface CopyMetadata {
  /** Source thread ID */
  threadId: string;

  /** Source context type */
  context: 'personal' | 'project';

  /** Source project ID (if from project) */
  projectId?: string;

  /** Timestamp when copy was created */
  copiedAt: number;
}

/**
 * Rollback data for cleanup on failure
 */
export interface RollbackData {
  /** Cloud file IDs to delete */
  uploadedFiles?: string[];

  /** Local file paths to delete */
  downloadedFiles?: string[];

  /** Thread ID to delete if created */
  createdThreadId?: string;
}

/**
 * Complete copy operation state
 */
export interface CopyOperation {
  /** Unique operation identifier */
  id: string;

  /** Source thread ID */
  sourceThreadId: string;

  /** Target context (projectId or null for personal) */
  targetContext: string | null;

  /** Operation status */
  status: CopyOperationStatus;

  /** Progress information */
  progress: CopyProgress;

  /** Operation creation timestamp */
  createdAt: number;

  /** Operation completion timestamp */
  completedAt?: number;

  /** Error information if failed */
  error?: CopyOperationError;

  /** Rollback tracking data */
  rollbackData?: RollbackData;
}

/**
 * Duplicate detection result
 */
export interface DuplicateInfo {
  /** Whether a duplicate was found */
  isDuplicate: boolean;

  /** Previous copy date if duplicate */
  previousCopyDate?: number;

  /** Previous copied thread ID if duplicate */
  previousThreadId?: string;
}

/**
 * Large file confirmation data
 */
export interface LargeFileConfirmation {
  /** Whether confirmation is needed */
  needsConfirmation: boolean;

  /** Total file size in bytes */
  totalSize: number;

  /** Number of files */
  fileCount: number;

  /** Estimated transfer time in seconds */
  estimatedTransferTime?: number;

  /** List of large files */
  largeFiles?: Array<{ filename: string; size: number }>;
}
