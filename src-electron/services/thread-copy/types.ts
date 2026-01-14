/**
 * Thread Copy Service Types
 * Internal types for the main process thread copy implementation
 */

import type {
  CopyOptions,
  CopyProgress,
  CopyOperation,
  LocalFileReference,
  CloudFileReference,
  MigrationProgress,
  DuplicateInfo,
  LargeFileConfirmation,
} from '../../../src-shared/types/thread-copy.types.js';
import type { Thread } from '../../repository/thread-repository.js';

/**
 * Thread Copy Service Interface
 *
 * Core service responsible for orchestrating thread copy operations
 * with transactional guarantees and automatic rollback on failure.
 */
export interface IThreadCopyService {
  /**
   * Copy a thread from one context to another
   *
   * @param sourceThreadId - ID of the thread to copy
   * @param targetContext - Destination context (projectId or null for personal)
   * @param options - Copy operation options
   * @returns Promise resolving to the new thread
   * @throws CopyOperationError if operation fails
   */
  copyThread(
    sourceThreadId: string,
    targetContext: string | null,
    options?: CopyOptions,
  ): Promise<Thread>;

  /**
   * Cancel an in-progress copy operation
   *
   * @param operationId - ID of the operation to cancel
   * @returns Promise resolving when cancellation is complete
   */
  cancelCopy(operationId: string): Promise<void>;

  /**
   * Get progress for an ongoing copy operation
   *
   * @param operationId - ID of the operation
   * @returns Progress information or null if not found
   */
  getProgress(operationId: string): CopyProgress | null;

  /**
   * Check if a thread has been previously copied to a destination
   *
   * @param sourceThreadId - Source thread ID
   * @param targetContext - Target context
   * @returns Duplicate detection result
   */
  checkDuplicate(sourceThreadId: string, targetContext: string | null): Promise<DuplicateInfo>;

  /**
   * Check if large file confirmation is needed
   *
   * @param sourceThreadId - Source thread ID
   * @returns Large file confirmation data
   */
  checkLargeFiles(sourceThreadId: string): Promise<LargeFileConfirmation>;
}

/**
 * File Migration Service Interface
 *
 * Handles bidirectional file transfers between local and cloud storage.
 */
export interface IFileMigrationService {
  /**
   * Migrate files from personal space to project workspace
   *
   * @param files - Array of local file paths
   * @param targetProjectId - Destination project ID
   * @param onProgress - Progress callback
   * @returns Array of cloud file references
   * @throws Error if migration fails
   */
  migrateToCloud(
    files: LocalFileReference[],
    targetProjectId: string,
    onProgress?: (progress: MigrationProgress) => void,
  ): Promise<CloudFileReference[]>;

  /**
   * Migrate files from project workspace to personal space
   *
   * @param files - Array of cloud file references
   * @param targetThreadId - Destination thread ID (for local path)
   * @param onProgress - Progress callback
   * @returns Array of local file paths
   * @throws Error if migration fails
   */
  migrateToLocal(
    files: CloudFileReference[],
    targetThreadId: string,
    onProgress?: (progress: MigrationProgress) => void,
  ): Promise<LocalFileReference[]>;

  /**
   * Cancel an ongoing migration
   *
   * @param operationId - Migration operation ID
   */
  cancelMigration(operationId: string): Promise<void>;
}

/**
 * Rollback Process Interface
 *
 * Handles cleanup of partial state when copy operations fail.
 */
export interface IRollbackProcess {
  /**
   * Execute rollback for a failed copy operation
   *
   * @param operation - The failed operation state
   * @returns Promise resolving when rollback is complete
   */
  execute(operation: CopyOperation): Promise<void>;

  /**
   * Delete uploaded cloud files
   *
   * @param fileIds - Array of cloud file IDs to delete
   * @returns Promise resolving when deletion is complete
   */
  deleteCloudFiles(fileIds: string[]): Promise<void>;

  /**
   * Delete downloaded local files
   *
   * @param filePaths - Array of local file paths to delete
   * @returns Promise resolving when deletion is complete
   */
  deleteLocalFiles(filePaths: string[]): Promise<void>;

  /**
   * Delete a created thread
   *
   * @param threadId - Thread ID to delete
   * @returns Promise resolving when deletion is complete
   */
  deleteThread(threadId: string): Promise<void>;
}

/**
 * Operation Queue Interface
 *
 * Manages sequential processing of copy operations.
 */
export interface IOperationQueue {
  /**
   * Add an operation to the queue
   *
   * @param operation - Operation to queue
   * @returns Promise resolving when operation completes
   */
  enqueue(operation: CopyOperation): Promise<Thread>;

  /**
   * Get the currently active operation
   *
   * @returns Active operation or null
   */
  getActive(): CopyOperation | null;

  /**
   * Get all pending operations
   *
   * @returns Array of pending operations
   */
  getPending(): CopyOperation[];

  /**
   * Cancel all pending operations
   */
  cancelAll(): Promise<void>;
}

/**
 * Permission Validator Interface
 *
 * Validates user permissions for copy operations.
 */
export interface IPermissionValidator {
  /**
   * Check if user has write permission to a project
   *
   * @param projectId - Project ID to check
   * @returns True if user has write permission
   */
  canWriteToProject(projectId: string): Promise<boolean>;

  /**
   * Get all projects where user has write permission
   *
   * @returns Array of project IDs
   */
  getWritableProjects(): Promise<string[]>;
}
